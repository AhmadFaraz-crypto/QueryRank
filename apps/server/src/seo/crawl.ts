// Whole-site SEO crawl (bounded). Starting from a URL it discovers pages via
// the sitemap and by following internal links, audits up to MAX_PAGES of them,
// and aggregates the results into a site report: average score, the issues that
// recur across the site, and a per-page breakdown.
//
// It is deliberately bounded (page cap + concurrency + per-page timeout + a
// small politeness delay) and respects robots.txt disallow rules so it stays a
// single, well-behaved request.

import { safeFetch, safeFetchText, type FetchedPage } from './fetch'
import {
  originOf,
  parseHtml,
  runPageChecks,
  runSiteChecks,
  summarize,
  type Category,
  type Check,
  type Counts,
  type Severity,
} from './audit'

const MAX_PAGES = 30
const CONCURRENCY = 5
const DISCOVERY_CAP = 300 // never queue more than this many candidate URLs
const NESTED_SITEMAP_LIMIT = 8
const ROUND_DELAY_MS = 150

const SKIP_EXT =
  /\.(pdf|jpe?g|png|gif|svg|webp|ico|zip|gz|tar|rar|mp4|webm|mp3|wav|css|js|json|xml|rss|woff2?|ttf|eot|csv|xlsx?|docx?)$/i

export interface CrawlPage {
  url: string
  finalUrl?: string
  status: number
  score: number
  counts: Counts
  checks: Check[]
  error?: string
}

export interface CommonIssue {
  id: string
  label: string
  category: Category
  severity: Severity
  pages: number
}

export interface SiteReport {
  url: string
  site: string
  finalUrl: string
  crawledAt: string
  pagesCrawled: number
  pagesDiscovered: number
  capped: boolean
  avgScore: number
  counts: Counts
  siteChecks: Check[]
  commonIssues: CommonIssue[]
  pages: CrawlPage[]
}

/** Parse robots.txt into the Disallow rules for `*` and any Sitemap entries. */
function parseRobots(body: string): { disallow: string[]; sitemaps: string[] } {
  const disallow: string[] = []
  const sitemaps: string[] = []
  let appliesToAll = false
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim()
    if (!line) continue
    const [field, ...rest] = line.split(':')
    const value = rest.join(':').trim()
    const key = field.trim().toLowerCase()
    if (key === 'user-agent') appliesToAll = value === '*'
    else if (key === 'sitemap' && value) sitemaps.push(value)
    else if (key === 'disallow' && appliesToAll && value) disallow.push(value)
  }
  return { disallow, sitemaps }
}

function isDisallowed(path: string, rules: string[]): boolean {
  return rules.some((r) => r !== '' && path.startsWith(r))
}

/** Normalize a URL for de-duplication: absolute, no hash, no trailing slash. */
function normalize(href: string, base: string): string | null {
  let u: URL
  try {
    u = new URL(href, base)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  u.hash = ''
  let s = u.toString()
  if (s.endsWith('/') && u.pathname !== '/') s = s.slice(0, -1)
  return s
}

function sameHost(url: string, host: string): boolean {
  try {
    return new URL(url).host === host
  } catch {
    return false
  }
}

/** Extract same-host, crawlable links from a parsed page. */
function extractLinks(html: ReturnType<typeof parseHtml>, baseUrl: string, host: string): string[] {
  const out: string[] = []
  for (const a of html.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') ?? ''
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) continue
    const n = normalize(href, baseUrl)
    if (!n || !sameHost(n, host)) continue
    if (SKIP_EXT.test(new URL(n).pathname)) continue
    out.push(n)
  }
  return out
}

/** Pull page URLs from a sitemap (following one level of sitemap indexes). */
async function sitemapUrls(sitemapUrl: string, host: string): Promise<string[]> {
  const first = await safeFetchText(sitemapUrl)
  if (!first || first.status < 200 || first.status >= 300) return []
  const locs = (body: string) => [...body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1])

  if (/<sitemapindex/i.test(first.body)) {
    const nested = locs(first.body).slice(0, NESTED_SITEMAP_LIMIT)
    const all: string[] = []
    for (const sm of nested) {
      const child = await safeFetchText(sm)
      if (child && child.status >= 200 && child.status < 300) all.push(...locs(child.body))
      if (all.length >= DISCOVERY_CAP) break
    }
    return all.filter((u) => sameHost(u, host))
  }
  return locs(first.body).filter((u) => sameHost(u, host))
}

/** Crawl a site (bounded) and return an aggregated report. */
export async function runCrawl(startUrl: string): Promise<SiteReport> {
  // First page establishes the canonical origin/host (after any redirect).
  const firstPage: FetchedPage = await safeFetch(startUrl)
  const site = originOf(firstPage.finalUrl)
  const host = new URL(firstPage.finalUrl).host

  // robots.txt → disallow rules + sitemap locations.
  const robots = await safeFetchText(`${site}/robots.txt`)
  const { disallow, sitemaps } = robots && robots.status < 300 ? parseRobots(robots.body) : { disallow: [], sitemaps: [] }
  const sitemapList = sitemaps.length ? sitemaps : [`${site}/sitemap.xml`]

  // Seed the queue: the start page, then any sitemap URLs.
  const seen = new Set<string>()
  const queue: string[] = []
  const enqueue = (url: string) => {
    const n = normalize(url, site)
    if (!n || seen.size >= DISCOVERY_CAP || seen.has(n) || !sameHost(n, host)) return
    if (isDisallowed(new URL(n).pathname, disallow)) return
    seen.add(n)
    queue.push(n)
  }
  enqueue(firstPage.finalUrl)
  for (const sm of sitemapList) {
    for (const u of await sitemapUrls(sm, host)) enqueue(u)
  }

  const pages: CrawlPage[] = []
  const auditOne = async (url: string): Promise<void> => {
    try {
      // Reuse the already-fetched first page instead of hitting it twice.
      const page = url === normalize(firstPage.finalUrl, site) ? firstPage : await safeFetch(url)
      const root = parseHtml(page.body)
      const checks = runPageChecks(page, root)
      const { counts, score } = summarize(checks)
      pages.push({ url, finalUrl: page.finalUrl, status: page.status, score, counts, checks })
      for (const link of extractLinks(root, page.finalUrl, host)) enqueue(link)
    } catch (err) {
      pages.push({
        url,
        status: 0,
        score: 0,
        counts: { good: 0, warning: 0, error: 0, total: 0 },
        checks: [],
        error: err instanceof Error ? err.message : 'Failed to fetch.',
      })
    }
  }

  // Process breadth-first in bounded concurrent batches until the page cap.
  while (pages.length < MAX_PAGES && queue.length) {
    const slots = Math.min(CONCURRENCY, MAX_PAGES - pages.length)
    const batch = queue.splice(0, slots)
    await Promise.all(batch.map(auditOne))
    if (queue.length && pages.length < MAX_PAGES) await delay(ROUND_DELAY_MS)
  }

  // Site-level checks run once for the whole site.
  const siteChecks = await runSiteChecks(firstPage.finalUrl)

  // --- Aggregate ------------------------------------------------------------
  const scored = pages.filter((p) => p.checks.length)
  const avgScore = scored.length ? Math.round(scored.reduce((s, p) => s + p.score, 0) / scored.length) : 0
  const counts: Counts = pages.reduce(
    (acc, p) => ({
      good: acc.good + p.counts.good,
      warning: acc.warning + p.counts.warning,
      error: acc.error + p.counts.error,
      total: acc.total + p.counts.total,
    }),
    { good: 0, warning: 0, error: 0, total: 0 },
  )

  // Issues that recur across pages: count pages where each check isn't "good".
  const issueMap = new Map<string, CommonIssue>()
  for (const p of scored) {
    for (const c of p.checks) {
      if (c.severity === 'good') continue
      const cur = issueMap.get(c.id)
      if (cur) {
        cur.pages++
        if (c.severity === 'error') cur.severity = 'error'
      } else {
        issueMap.set(c.id, { id: c.id, label: c.label, category: c.category, severity: c.severity, pages: 1 })
      }
    }
  }
  const sevRank = { error: 0, warning: 1, good: 2 }
  const commonIssues = [...issueMap.values()].sort(
    (a, b) => b.pages - a.pages || sevRank[a.severity] - sevRank[b.severity],
  )

  return {
    url: startUrl,
    site,
    finalUrl: firstPage.finalUrl,
    crawledAt: new Date().toISOString(),
    pagesCrawled: pages.length,
    pagesDiscovered: seen.size,
    capped: seen.size > pages.length,
    avgScore,
    counts,
    siteChecks,
    commonIssues,
    pages: pages.sort((a, b) => a.score - b.score), // worst first
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
