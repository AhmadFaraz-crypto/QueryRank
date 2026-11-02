// The SEO audit engine. Given a URL it fetches the page (safely), parses the
// HTML, and runs a set of rule-based on-page checks — the same things an SEO
// would eyeball: title, meta description, headings, indexability, social tags,
// images, and a few technical signals (robots.txt, sitemap, mixed content).
//
// Everything here is derived from the real fetched page — no made-up data.
//
// Checks are split into two groups so a whole-site crawl can run the per-page
// checks for every page but the site-level checks (robots.txt, sitemap) only
// once: `runPageChecks` (needs just the fetched page) and `runSiteChecks`.

import { parse, type HTMLElement } from 'node-html-parser'
import { safeFetch, safeFetchText, FetchError, type FetchedPage } from './fetch'

export type Severity = 'good' | 'warning' | 'error'
export type Category = 'Indexability' | 'Meta' | 'Content' | 'Social' | 'Technical'

export interface Check {
  id: string
  category: Category
  label: string
  severity: Severity
  detail: string
  recommendation?: string
}

export interface Counts {
  good: number
  warning: number
  error: number
  total: number
}

export interface AuditReport {
  url: string
  finalUrl: string
  fetchedAt: string
  status: number
  elapsedMs: number
  redirects: number
  pageBytes: number
  score: number
  counts: Counts
  checks: Check[]
}

export { FetchError }

export function parseHtml(body: string): HTMLElement {
  return parse(body, { comment: false })
}

export function originOf(u: string): string {
  const url = new URL(u)
  return `${url.protocol}//${url.host}`
}

function textWords(root: HTMLElement): number {
  const clone = parse(root.toString())
  clone.querySelectorAll('script, style, noscript, template').forEach((n) => n.remove())
  const body = clone.querySelector('body') ?? clone
  const words = body.text.replace(/\s+/g, ' ').trim()
  return words ? words.split(' ').length : 0
}

export function summarize(checks: Check[]): { counts: Counts; score: number } {
  const counts: Counts = {
    good: checks.filter((c) => c.severity === 'good').length,
    warning: checks.filter((c) => c.severity === 'warning').length,
    error: checks.filter((c) => c.severity === 'error').length,
    total: checks.length,
  }
  const score = counts.total ? Math.round((100 * (counts.good + counts.warning * 0.5)) / counts.total) : 0
  return { counts, score }
}

/** All checks that can be judged from a single fetched page + its parsed HTML. */
export function runPageChecks(page: FetchedPage, root: HTMLElement): Check[] {
  const checks: Check[] = []
  const add = (c: Check) => checks.push(c)

  const isHttps = new URL(page.finalUrl).protocol === 'https:'
  const head = root.querySelector('head') ?? root
  const htmlEl = root.querySelector('html')

  // --- Indexability ---------------------------------------------------------
  add({
    id: 'https',
    category: 'Indexability',
    label: 'HTTPS',
    severity: isHttps ? 'good' : 'error',
    detail: isHttps ? 'Served over a secure HTTPS connection.' : 'This page is served over plain HTTP.',
    recommendation: isHttps ? undefined : 'Serve the site over HTTPS and redirect HTTP to HTTPS.',
  })

  const statusOk = page.status >= 200 && page.status < 300
  add({
    id: 'status',
    category: 'Indexability',
    label: 'HTTP status',
    severity: statusOk ? 'good' : 'error',
    detail:
      `Returned ${page.status}` +
      (page.redirects ? ` after ${page.redirects} redirect${page.redirects > 1 ? 's' : ''}.` : '.'),
    recommendation: statusOk ? undefined : 'Search engines can’t index a page that doesn’t return a 2xx status.',
  })

  const robotsMeta = (head.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '').toLowerCase()
  const xRobots = (page.headers.get('x-robots-tag') ?? '').toLowerCase()
  const noindex = robotsMeta.includes('noindex') || xRobots.includes('noindex')
  add({
    id: 'indexable',
    category: 'Indexability',
    label: 'Indexable',
    severity: noindex ? 'error' : 'good',
    detail: noindex
      ? 'This page is marked "noindex" and will be excluded from search results.'
      : 'Nothing blocks this page from being indexed.',
    recommendation: noindex ? 'Remove the noindex directive if you want this page to rank.' : undefined,
  })

  const canonical = head.querySelector('link[rel="canonical"]')?.getAttribute('href')
  add({
    id: 'canonical',
    category: 'Indexability',
    label: 'Canonical tag',
    severity: canonical ? 'good' : 'warning',
    detail: canonical ? `Canonical points to ${canonical}` : 'No canonical link was found.',
    recommendation: canonical ? undefined : 'Add a <link rel="canonical"> to avoid duplicate-content issues.',
  })

  // --- Meta -----------------------------------------------------------------
  const title = head.querySelector('title')?.text.trim() ?? ''
  const tLen = title.length
  add({
    id: 'title',
    category: 'Meta',
    label: 'Title tag',
    severity: !title ? 'error' : tLen < 30 || tLen > 60 ? 'warning' : 'good',
    detail: !title ? 'The page has no <title>.' : `“${title}” (${tLen} characters).`,
    recommendation: !title
      ? 'Add a descriptive <title> — it’s the single most important on-page tag.'
      : tLen < 30
        ? 'The title is short; aim for 30–60 characters to use the full SERP width.'
        : tLen > 60
          ? 'The title may be truncated in search results; keep it under ~60 characters.'
          : undefined,
  })

  const desc = head.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? ''
  const dLen = desc.length
  add({
    id: 'description',
    category: 'Meta',
    label: 'Meta description',
    severity: !desc ? 'warning' : dLen < 70 || dLen > 160 ? 'warning' : 'good',
    detail: !desc ? 'No meta description was found.' : `${dLen} characters.`,
    recommendation: !desc
      ? 'Add a meta description (70–160 chars) — it’s your SERP ad copy.'
      : dLen < 70
        ? 'The description is short; 70–160 characters reads best in search results.'
        : dLen > 160
          ? 'The description may be truncated; keep it under ~160 characters.'
          : undefined,
  })

  const viewport = head.querySelector('meta[name="viewport"]')?.getAttribute('content')
  add({
    id: 'viewport',
    category: 'Meta',
    label: 'Mobile viewport',
    severity: viewport ? 'good' : 'warning',
    detail: viewport ? 'A responsive viewport meta tag is set.' : 'No viewport meta tag — mobile rendering may break.',
    recommendation: viewport ? undefined : 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
  })

  const lang = htmlEl?.getAttribute('lang')
  add({
    id: 'lang',
    category: 'Meta',
    label: 'Language declared',
    severity: lang ? 'good' : 'warning',
    detail: lang ? `Document language is "${lang}".` : 'The <html> tag has no lang attribute.',
    recommendation: lang ? undefined : 'Add a lang attribute to <html> (e.g. lang="en") for accessibility and i18n.',
  })

  // --- Content --------------------------------------------------------------
  const h1s = root.querySelectorAll('h1')
  add({
    id: 'h1',
    category: 'Content',
    label: 'H1 heading',
    severity: h1s.length === 1 ? 'good' : h1s.length === 0 ? 'error' : 'warning',
    detail:
      h1s.length === 0
        ? 'No H1 heading was found.'
        : h1s.length === 1
          ? `Exactly one H1: “${h1s[0].text.trim().slice(0, 80)}”.`
          : `Found ${h1s.length} H1 headings.`,
    recommendation:
      h1s.length === 0
        ? 'Add a single, descriptive H1 that summarizes the page.'
        : h1s.length > 1
          ? 'Use a single H1 per page; demote the rest to H2/H3.'
          : undefined,
  })

  const words = textWords(root)
  add({
    id: 'content',
    category: 'Content',
    label: 'Content length',
    severity: words >= 300 ? 'good' : words >= 100 ? 'warning' : 'error',
    detail: `About ${words} words of visible text.`,
    recommendation: words < 300 ? 'Thin pages rank poorly; aim for substantive, useful content (300+ words).' : undefined,
  })

  const imgs = root.querySelectorAll('img')
  const missingAlt = imgs.filter((i) => !(i.getAttribute('alt') ?? '').trim()).length
  add({
    id: 'img-alt',
    category: 'Content',
    label: 'Image alt text',
    severity: imgs.length === 0 || missingAlt === 0 ? 'good' : missingAlt <= imgs.length / 2 ? 'warning' : 'error',
    detail:
      imgs.length === 0
        ? 'No images on the page.'
        : missingAlt === 0
          ? `All ${imgs.length} images have alt text.`
          : `${missingAlt} of ${imgs.length} images are missing alt text.`,
    recommendation: missingAlt > 0 ? 'Add descriptive alt text to every meaningful image.' : undefined,
  })

  // --- Social ---------------------------------------------------------------
  const og = ['og:title', 'og:description', 'og:image'].filter(
    (p) => head.querySelector(`meta[property="${p}"]`)?.getAttribute('content'),
  )
  add({
    id: 'open-graph',
    category: 'Social',
    label: 'Open Graph tags',
    severity: og.length === 3 ? 'good' : 'warning',
    detail:
      og.length === 3
        ? 'og:title, og:description and og:image are all set.'
        : og.length === 0
          ? 'No Open Graph tags found.'
          : `Only ${og.length} of 3 core Open Graph tags are set.`,
    recommendation:
      og.length < 3 ? 'Add og:title, og:description and og:image so shared links render a rich preview.' : undefined,
  })

  const twitter = head.querySelector('meta[name="twitter:card"]')?.getAttribute('content')
  add({
    id: 'twitter',
    category: 'Social',
    label: 'Twitter card',
    severity: twitter ? 'good' : 'warning',
    detail: twitter ? `twitter:card is "${twitter}".` : 'No Twitter card metadata.',
    recommendation: twitter ? undefined : 'Add a twitter:card tag for better link previews on X/Twitter.',
  })

  // --- Technical ------------------------------------------------------------
  const jsonLd = root.querySelectorAll('script[type="application/ld+json"]').length
  add({
    id: 'structured-data',
    category: 'Technical',
    label: 'Structured data',
    severity: jsonLd > 0 ? 'good' : 'warning',
    detail: jsonLd > 0 ? `${jsonLd} JSON-LD block${jsonLd > 1 ? 's' : ''} found.` : 'No JSON-LD structured data found.',
    recommendation: jsonLd > 0 ? undefined : 'Add schema.org JSON-LD to enable rich results.',
  })

  if (isHttps) {
    const insecure = root
      .querySelectorAll('img[src], script[src], link[href], iframe[src]')
      .map((el) => el.getAttribute('src') || el.getAttribute('href') || '')
      .filter((v) => v.startsWith('http://')).length
    add({
      id: 'mixed-content',
      category: 'Technical',
      label: 'Mixed content',
      severity: insecure === 0 ? 'good' : 'error',
      detail: insecure === 0 ? 'No insecure (http) resources on this HTTPS page.' : `${insecure} resources load over http://.`,
      recommendation: insecure > 0 ? 'Load all resources over HTTPS; browsers block mixed content.' : undefined,
    })
  }

  const slowMs = 1800
  add({
    id: 'response-time',
    category: 'Technical',
    label: 'Response time',
    severity: page.elapsedMs <= slowMs ? 'good' : 'warning',
    detail: `The page responded in ${(page.elapsedMs / 1000).toFixed(2)}s.`,
    recommendation: page.elapsedMs > slowMs ? 'Slow responses hurt crawl budget and Core Web Vitals; improve TTFB.' : undefined,
  })

  const kb = Math.round(page.bytes / 1024)
  add({
    id: 'page-weight',
    category: 'Technical',
    label: 'HTML weight',
    severity: page.bytes <= 500 * 1024 ? 'good' : 'warning',
    detail: `The HTML document is ${kb} KB.`,
    recommendation: page.bytes > 500 * 1024 ? 'Large HTML slows rendering; trim inline markup and defer what you can.' : undefined,
  })

  return checks
}

/** Site-level checks that need their own fetches: robots.txt and the sitemap. */
export async function runSiteChecks(finalUrl: string): Promise<Check[]> {
  const base = originOf(finalUrl)
  const checks: Check[] = []

  const robotsTxt = await safeFetchText(`${base}/robots.txt`)
  const hasRobots = !!robotsTxt && robotsTxt.status >= 200 && robotsTxt.status < 300 && robotsTxt.body.trim().length > 0
  checks.push({
    id: 'robots-txt',
    category: 'Technical',
    label: 'robots.txt',
    severity: hasRobots ? 'good' : 'warning',
    detail: hasRobots ? 'A robots.txt file is present.' : 'No robots.txt was found at the site root.',
    recommendation: hasRobots ? undefined : 'Add a robots.txt to guide crawlers and point to your sitemap.',
  })

  let hasSitemap = hasRobots && /sitemap:/i.test(robotsTxt!.body)
  if (!hasSitemap) {
    const sm = await safeFetchText(`${base}/sitemap.xml`)
    hasSitemap = !!sm && sm.status >= 200 && sm.status < 300 && /<urlset|<sitemapindex/i.test(sm.body)
  }
  checks.push({
    id: 'sitemap',
    category: 'Technical',
    label: 'XML sitemap',
    severity: hasSitemap ? 'good' : 'warning',
    detail: hasSitemap ? 'An XML sitemap was found.' : 'No XML sitemap found (checked robots.txt and /sitemap.xml).',
    recommendation: hasSitemap ? undefined : 'Publish an XML sitemap and reference it from robots.txt.',
  })

  return checks
}

/** Run the full single-page audit for a URL and return a scored report. */
export async function runAudit(rawUrl: string): Promise<AuditReport> {
  const page = await safeFetch(rawUrl)
  const root = parseHtml(page.body)
  const checks = [...runPageChecks(page, root), ...(await runSiteChecks(page.finalUrl))]
  const { counts, score } = summarize(checks)

  return {
    url: rawUrl,
    finalUrl: page.finalUrl,
    fetchedAt: new Date().toISOString(),
    status: page.status,
    elapsedMs: page.elapsedMs,
    redirects: page.redirects,
    pageBytes: page.bytes,
    score,
    counts,
    checks,
  }
}
