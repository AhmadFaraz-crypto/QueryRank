import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/client'
import { seoAudits, siteAudits } from '../db/schema'
import { getSession } from '../session'
import { runAudit, FetchError } from '../seo/audit'
import { runCrawl } from '../seo/crawl'

export const auditsRouter = new Hono<{ Variables: { userId: string } }>()

// All audit routes require a signed-in user; rows are always user-scoped.
auditsRouter.use('*', async (c, next) => {
  const session = await getSession(c)
  if (!session) return c.json({ error: 'unauthorized' }, 401)
  c.set('userId', session.sub)
  await next()
})

// A small in-memory throttle: running an audit fetches an external site, so we
// cap how often each user can trigger one. Resets on restart — fine for abuse
// control on a single instance.
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 8
const hits = new Map<string, number[]>()
function rateLimited(userId: string): boolean {
  const now = Date.now()
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(userId, recent)
    return true
  }
  recent.push(now)
  hits.set(userId, recent)
  return false
}

/** List the user's past audits (summary only — not the full report). */
auditsRouter.get('/', async (c) => {
  const rows = await db
    .select({
      id: seoAudits.id,
      url: seoAudits.url,
      finalUrl: seoAudits.finalUrl,
      score: seoAudits.score,
      createdAt: seoAudits.createdAt,
    })
    .from(seoAudits)
    .where(eq(seoAudits.userId, c.get('userId')))
    .orderBy(desc(seoAudits.createdAt))
    .limit(50)
  return c.json(rows)
})

/** Fetch one full audit report by id. */
auditsRouter.get('/:id', async (c) => {
  const [row] = await db
    .select()
    .from(seoAudits)
    .where(and(eq(seoAudits.id, c.req.param('id')), eq(seoAudits.userId, c.get('userId'))))
  if (!row) return c.json({ error: 'not found' }, 404)
  return c.json({ id: row.id, createdAt: row.createdAt, ...(row.report as object) })
})

/** Run a new audit for a URL, persist it, and return the full report. */
auditsRouter.post('/', async (c) => {
  if (rateLimited(c.get('userId'))) {
    return c.json({ error: 'Too many audits — please wait a minute and try again.' }, 429)
  }
  const body = await c.req.json<{ url?: string }>().catch(() => ({}) as { url?: string })
  let url = (body.url ?? '').trim()
  if (!url) return c.json({ error: 'A URL is required.' }, 400)
  // Be forgiving: default to https:// when the user omits the scheme.
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`

  try {
    const report = await runAudit(url)
    const [row] = await db
      .insert(seoAudits)
      .values({
        userId: c.get('userId'),
        url: report.url,
        finalUrl: report.finalUrl,
        score: report.score,
        report,
      })
      .returning({ id: seoAudits.id, createdAt: seoAudits.createdAt })
    return c.json({ id: row.id, createdAt: row.createdAt, ...report }, 201)
  } catch (err) {
    if (err instanceof FetchError) return c.json({ error: err.message }, 400)
    console.error('SEO audit failed:', err)
    return c.json({ error: 'The audit failed unexpectedly. Please try again.' }, 500)
  }
})

/** Delete a saved audit. */
auditsRouter.delete('/:id', async (c) => {
  await db
    .delete(seoAudits)
    .where(and(eq(seoAudits.id, c.req.param('id')), eq(seoAudits.userId, c.get('userId'))))
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Whole-site crawl audits. A crawl fetches up to ~30 pages, so it's throttled
// harder than a single-page audit.
// ---------------------------------------------------------------------------

export const siteAuditsRouter = new Hono<{ Variables: { userId: string } }>()

siteAuditsRouter.use('*', async (c, next) => {
  const session = await getSession(c)
  if (!session) return c.json({ error: 'unauthorized' }, 401)
  c.set('userId', session.sub)
  await next()
})

const SITE_WINDOW_MS = 5 * 60_000
const SITE_MAX_PER_WINDOW = 3
const siteHits = new Map<string, number[]>()
function siteRateLimited(userId: string): boolean {
  const now = Date.now()
  const recent = (siteHits.get(userId) ?? []).filter((t) => now - t < SITE_WINDOW_MS)
  if (recent.length >= SITE_MAX_PER_WINDOW) {
    siteHits.set(userId, recent)
    return true
  }
  recent.push(now)
  siteHits.set(userId, recent)
  return false
}

/** List the user's past site crawls (summary only). */
siteAuditsRouter.get('/', async (c) => {
  const rows = await db
    .select({
      id: siteAudits.id,
      site: siteAudits.site,
      pagesCrawled: siteAudits.pagesCrawled,
      avgScore: siteAudits.avgScore,
      createdAt: siteAudits.createdAt,
    })
    .from(siteAudits)
    .where(eq(siteAudits.userId, c.get('userId')))
    .orderBy(desc(siteAudits.createdAt))
    .limit(50)
  return c.json(rows)
})

/** Fetch one full site report by id. */
siteAuditsRouter.get('/:id', async (c) => {
  const [row] = await db
    .select()
    .from(siteAudits)
    .where(and(eq(siteAudits.id, c.req.param('id')), eq(siteAudits.userId, c.get('userId'))))
  if (!row) return c.json({ error: 'not found' }, 404)
  return c.json({ id: row.id, createdAt: row.createdAt, ...(row.report as object) })
})

/** Run a whole-site crawl, persist it, and return the aggregated report. */
siteAuditsRouter.post('/', async (c) => {
  if (siteRateLimited(c.get('userId'))) {
    return c.json({ error: 'Too many site crawls — please wait a few minutes and try again.' }, 429)
  }
  const body = await c.req.json<{ url?: string }>().catch(() => ({}) as { url?: string })
  let url = (body.url ?? '').trim()
  if (!url) return c.json({ error: 'A URL is required.' }, 400)
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`

  try {
    const report = await runCrawl(url)
    const [row] = await db
      .insert(siteAudits)
      .values({
        userId: c.get('userId'),
        site: report.site,
        pagesCrawled: report.pagesCrawled,
        avgScore: report.avgScore,
        report,
      })
      .returning({ id: siteAudits.id, createdAt: siteAudits.createdAt })
    return c.json({ id: row.id, createdAt: row.createdAt, ...report }, 201)
  } catch (err) {
    if (err instanceof FetchError) return c.json({ error: err.message }, 400)
    console.error('Site crawl failed:', err)
    return c.json({ error: 'The site crawl failed unexpectedly. Please try again.' }, 500)
  }
})

/** Delete a saved site crawl. */
siteAuditsRouter.delete('/:id', async (c) => {
  await db
    .delete(siteAudits)
    .where(and(eq(siteAudits.id, c.req.param('id')), eq(siteAudits.userId, c.get('userId'))))
  return c.json({ ok: true })
})
