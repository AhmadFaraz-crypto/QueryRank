// Safe server-side fetching of user-supplied URLs. Because the audit pulls an
// arbitrary URL the user types, this is a classic SSRF surface: without guards
// it could be aimed at localhost, a private subnet, or the cloud metadata
// endpoint (169.254.169.254). Every request here validates the scheme and the
// resolved IP of every redirect hop, and caps time and body size.

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_REDIRECTS = 5
const TIMEOUT_MS = 12_000
const MAX_BYTES = 3 * 1024 * 1024 // 3 MB of HTML is plenty for one page
const UA = 'QueryRankBot/1.0 (+https://getqueryrank.com; SEO audit)'

export class FetchError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'invalid_url'
      | 'blocked_host'
      | 'too_many_redirects'
      | 'too_large'
      | 'timeout'
      | 'network',
  ) {
    super(message)
  }
}

export interface FetchedPage {
  finalUrl: string
  status: number
  headers: Headers
  body: string
  elapsedMs: number
  redirects: number
  bytes: number
}

/** Parse an IPv4 dotted string into a 32-bit unsigned int, or null. */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    const o = Number(p)
    if (!Number.isInteger(o) || o < 0 || o > 255) return null
    n = n * 256 + o
  }
  return n >>> 0
}

function ipv4Blocked(ip: string): boolean {
  const n = ipv4ToInt(ip)
  if (n === null) return true // unparseable → treat as unsafe
  const inRange = (base: string, bits: number) => {
    const b = ipv4ToInt(base)!
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    return (n & mask) === (b & mask)
  }
  return (
    inRange('0.0.0.0', 8) || // "this" network
    inRange('10.0.0.0', 8) || // private
    inRange('100.64.0.0', 10) || // CGNAT (covers Alibaba 100.100.100.200)
    inRange('127.0.0.0', 8) || // loopback
    inRange('169.254.0.0', 16) || // link-local incl. 169.254.169.254 metadata
    inRange('172.16.0.0', 12) || // private
    inRange('192.0.0.0', 24) ||
    inRange('192.0.2.0', 24) || // TEST-NET
    inRange('192.168.0.0', 16) || // private
    inRange('198.18.0.0', 15) || // benchmarking
    inRange('224.0.0.0', 4) || // multicast
    inRange('240.0.0.0', 4) // reserved / broadcast
  )
}

function ipv6Blocked(raw: string): boolean {
  const ip = raw.toLowerCase().split('%')[0] // strip zone id
  if (ip === '::1' || ip === '::') return true
  // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded v4 address.
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return ipv4Blocked(mapped[1])
  const p = ip.replace(/^::/, '').slice(0, 4)
  return (
    ip.startsWith('fc') ||
    ip.startsWith('fd') || // fc00::/7 unique-local
    ip.startsWith('fe8') ||
    ip.startsWith('fe9') ||
    ip.startsWith('fea') ||
    ip.startsWith('feb') || // fe80::/10 link-local
    ip.startsWith('ff') || // multicast
    p === '2001' && ip.startsWith('2001:db8') // documentation
  )
}

function ipBlocked(ip: string): boolean {
  const v = isIP(ip)
  if (v === 4) return ipv4Blocked(ip)
  if (v === 6) return ipv6Blocked(ip)
  return true
}

/** Validate a URL and confirm its host resolves only to public IPs. */
async function assertSafeUrl(raw: string): Promise<URL> {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new FetchError('That doesn’t look like a valid URL.', 'invalid_url')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new FetchError('Only http and https URLs can be audited.', 'invalid_url')
  }
  const host = u.hostname
  // Literal IPs: check directly. Hostnames: resolve and check every address.
  if (isIP(host)) {
    if (ipBlocked(host)) throw new FetchError('That address is not allowed.', 'blocked_host')
    return u
  }
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new FetchError('That host is not allowed.', 'blocked_host')
  }
  let addrs
  try {
    addrs = await lookup(host, { all: true })
  } catch {
    throw new FetchError('We couldn’t resolve that domain.', 'network')
  }
  if (!addrs.length || addrs.some((a) => ipBlocked(a.address))) {
    throw new FetchError('That host resolves to a blocked address.', 'blocked_host')
  }
  return u
}

/** Fetch one page safely, following (and re-validating) redirects by hand. */
export async function safeFetch(rawUrl: string): Promise<FetchedPage> {
  const started = Date.now()
  let current = rawUrl
  let redirects = 0

  while (true) {
    const url = await assertSafeUrl(current)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      })
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof Error && err.name === 'AbortError') {
        throw new FetchError('The site took too long to respond.', 'timeout')
      }
      throw new FetchError('We couldn’t reach that URL.', 'network')
    }
    clearTimeout(timer)

    // Manual redirect handling so we can re-validate each hop's destination.
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      redirects++
      if (redirects > MAX_REDIRECTS) {
        throw new FetchError('That URL redirects too many times.', 'too_many_redirects')
      }
      current = new URL(res.headers.get('location')!, url).toString()
      continue
    }

    // Read the body with a hard size cap (streaming so we don't buffer a 1 GB page).
    const reader = res.body?.getReader()
    const chunks: Uint8Array[] = []
    let bytes = 0
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          bytes += value.byteLength
          if (bytes > MAX_BYTES) {
            await reader.cancel()
            throw new FetchError('That page is too large to audit.', 'too_large')
          }
          chunks.push(value)
        }
      }
    }
    const body = new TextDecoder('utf-8').decode(concat(chunks))
    return {
      finalUrl: url.toString(),
      status: res.status,
      headers: res.headers,
      body,
      elapsedMs: Date.now() - started,
      redirects,
      bytes,
    }
  }
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.byteLength
  }
  return out
}

/** A best-effort GET for a same-origin helper file (robots.txt, sitemap.xml). */
export async function safeFetchText(rawUrl: string): Promise<{ status: number; body: string } | null> {
  try {
    const page = await safeFetch(rawUrl)
    return { status: page.status, body: page.body }
  } catch {
    return null
  }
}
