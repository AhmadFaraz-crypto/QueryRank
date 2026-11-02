// Client for the SEO audit API. The report shape mirrors the server's
// `AuditReport` (apps/server/src/seo/audit.ts) — keep the two in sync.

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

export interface AuditReport {
  id?: string
  createdAt?: string | null
  url: string
  finalUrl: string
  fetchedAt: string
  status: number
  elapsedMs: number
  redirects: number
  pageBytes: number
  score: number
  counts: { good: number; warning: number; error: number; total: number }
  checks: Check[]
}

export interface AuditSummary {
  id: string
  url: string
  finalUrl: string
  score: number
  createdAt: string | null
}

// --- Whole-site crawl (mirrors apps/server/src/seo/crawl.ts) ----------------
export interface CrawlPage {
  url: string
  finalUrl?: string
  status: number
  score: number
  counts: { good: number; warning: number; error: number; total: number }
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
  id?: string
  createdAt?: string | null
  url: string
  site: string
  finalUrl: string
  crawledAt: string
  pagesCrawled: number
  pagesDiscovered: number
  capped: boolean
  avgScore: number
  counts: { good: number; warning: number; error: number; total: number }
  siteChecks: Check[]
  commonIssues: CommonIssue[]
  pages: CrawlPage[]
}

export interface SiteSummary {
  id: string
  site: string
  pagesCrawled: number
  avgScore: number
  createdAt: string | null
}

async function asError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    return body.error || `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

export const auditApi = {
  async run(url: string): Promise<AuditReport> {
    const res = await fetch('/api/audits', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    if (!res.ok) throw new Error(await asError(res))
    return res.json()
  },

  async list(): Promise<AuditSummary[]> {
    const res = await fetch('/api/audits', { credentials: 'include' })
    if (!res.ok) throw new Error(await asError(res))
    return res.json()
  },

  async get(id: string): Promise<AuditReport> {
    const res = await fetch(`/api/audits/${id}`, { credentials: 'include' })
    if (!res.ok) throw new Error(await asError(res))
    return res.json()
  },

  async remove(id: string): Promise<void> {
    const res = await fetch(`/api/audits/${id}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) throw new Error(await asError(res))
  },
}

export const siteAuditApi = {
  async run(url: string): Promise<SiteReport> {
    const res = await fetch('/api/site-audits', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    if (!res.ok) throw new Error(await asError(res))
    return res.json()
  },

  async list(): Promise<SiteSummary[]> {
    const res = await fetch('/api/site-audits', { credentials: 'include' })
    if (!res.ok) throw new Error(await asError(res))
    return res.json()
  },

  async get(id: string): Promise<SiteReport> {
    const res = await fetch(`/api/site-audits/${id}`, { credentials: 'include' })
    if (!res.ok) throw new Error(await asError(res))
    return res.json()
  },

  async remove(id: string): Promise<void> {
    const res = await fetch(`/api/site-audits/${id}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) throw new Error(await asError(res))
  },
}
