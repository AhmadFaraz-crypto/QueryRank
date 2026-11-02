import { useEffect, useMemo, useState } from 'react'
import styles from './SeoAudit.module.scss'
import {
  auditApi,
  siteAuditApi,
  type AuditReport,
  type AuditSummary,
  type Category,
  type Check,
  type Counts,
  type Severity,
  type SiteReport,
  type SiteSummary,
} from './auditApi'
import { downloadAuditPdf, downloadSitePdf } from './auditPdf'

type Mode = 'page' | 'site'
const CATEGORY_ORDER: Category[] = ['Indexability', 'Meta', 'Content', 'Social', 'Technical']

function band(score: number) {
  return score >= 80 ? 'good' : score >= 50 ? 'warn' : 'bad'
}
function sevClass(s: Severity) {
  return s === 'good' ? styles.good : s === 'warning' ? styles.warn : styles.bad
}
function sevLabel(s: Severity) {
  return s === 'good' ? 'Pass' : s === 'warning' ? 'Warn' : 'Fail'
}

function ScoreRing({ score, caption }: { score: number; caption?: string }) {
  const r = 52
  const c = 2 * Math.PI * r
  const dash = (score / 100) * c
  return (
    <div className={`${styles.ring} ${styles[band(score)]}`}>
      <svg width="128" height="128" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} className={styles.ringTrack} />
        <circle cx="64" cy="64" r={r} className={styles.ringFill} strokeDasharray={`${dash} ${c}`} transform="rotate(-90 64 64)" />
      </svg>
      <div className={styles.ringNum}>
        <b>{score}</b>
        <small>{caption ?? '/ 100'}</small>
      </div>
    </div>
  )
}

/** Stacked passed/warnings/errors bar with a legend. */
function SeverityBar({ counts }: { counts: Counts }) {
  const total = counts.good + counts.warning + counts.error || 1
  const pct = (v: number) => `${(v / total) * 100}%`
  return (
    <div className={styles.sevbar}>
      <div className={styles.sevtrack}>
        {counts.good > 0 && <span className={styles.good} style={{ width: pct(counts.good) }} />}
        {counts.warning > 0 && <span className={styles.warn} style={{ width: pct(counts.warning) }} />}
        {counts.error > 0 && <span className={styles.bad} style={{ width: pct(counts.error) }} />}
      </div>
      <div className={styles.sevlegend}>
        <span className={styles.good}>
          <i /> Passed <b>{counts.good}</b>
        </span>
        <span className={styles.warn}>
          <i /> Warnings <b>{counts.warning}</b>
        </span>
        <span className={styles.bad}>
          <i /> Errors <b>{counts.error}</b>
        </span>
      </div>
    </div>
  )
}

/** Horizontal bar chart (bars coloured by severity). */
function BarChart({ items, max }: { items: Array<{ label: string; value: number; severity: Severity }>; max: number }) {
  const m = Math.max(max, 1)
  return (
    <ul className={styles.barchart}>
      {items.map((it, i) => (
        <li key={i}>
          <span className={styles.barlabel}>{it.label}</span>
          <span className={styles.bartrack}>
            <span
              className={`${styles.barfill} ${sevClass(it.severity)}`}
              style={{ width: `${Math.max(2, (it.value / m) * 100)}%` }}
            />
          </span>
          <span className={styles.barval}>{it.value}</span>
        </li>
      ))}
    </ul>
  )
}

/** Findings as a dark-header, zebra-striped table. */
function FindingsTable({ items }: { items: Check[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.findings}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Check</th>
            <th>Finding &amp; recommended fix</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td>
                <span className={`${styles.tag} ${sevClass(c.severity)}`}>{sevLabel(c.severity)}</span>
              </td>
              <td className={styles.cname}>{c.label}</td>
              <td className={styles.cfind}>
                {c.detail}
                {c.recommendation && <span className={`${styles.fix} ${sevClass(c.severity)}`}>Fix: {c.recommendation}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Single-page report body. */
function PageReport({ report }: { report: AuditReport }) {
  const grouped = useMemo(
    () => CATEGORY_ORDER.map((cat) => ({ cat, items: report.checks.filter((c) => c.category === cat) })).filter((g) => g.items.length),
    [report],
  )
  return (
    <div className={styles.report}>
      <div className={styles.summary}>
        <ScoreRing score={report.score} />
        <div className={styles.sumMain}>
          <a className={styles.sumUrl} href={report.finalUrl} target="_blank" rel="noreferrer noopener">
            {report.finalUrl}
          </a>
          <SeverityBar counts={report.counts} />
          <div className={styles.meta}>
            HTTP {report.status}
            {report.redirects ? ` · ${report.redirects} redirect(s)` : ''} · {(report.elapsedMs / 1000).toFixed(2)}s · {Math.round(report.pageBytes / 1024)} KB
          </div>
        </div>
        <button type="button" className={styles.pdfBtn} onClick={() => downloadAuditPdf(report)}>
          <PdfIcon /> Download PDF
        </button>
      </div>

      {grouped.map((g) => (
        <section key={g.cat} className={styles.group}>
          <h2>{g.cat}</h2>
          <FindingsTable items={g.items} />
        </section>
      ))}
    </div>
  )
}

/** Whole-site crawl report body. */
function SiteReportView({ report }: { report: SiteReport }) {
  const [open, setOpen] = useState<string | null>(null)
  const scored = report.pages.filter((p) => p.checks.length)
  const dist = [
    { label: 'Good (80–100)', value: scored.filter((p) => p.score >= 80).length, severity: 'good' as Severity },
    { label: 'Needs work (50–79)', value: scored.filter((p) => p.score >= 50 && p.score < 80).length, severity: 'warning' as Severity },
    { label: 'Poor (0–49)', value: scored.filter((p) => p.score < 50).length, severity: 'error' as Severity },
  ]
  return (
    <div className={styles.report}>
      <div className={styles.summary}>
        <ScoreRing score={report.avgScore} caption="avg" />
        <div className={styles.sumMain}>
          <a className={styles.sumUrl} href={report.site} target="_blank" rel="noreferrer noopener">
            {report.site}
          </a>
          <SeverityBar counts={report.counts} />
          <div className={styles.meta}>
            {report.pagesCrawled} pages crawled{report.capped ? ` of ${report.pagesDiscovered} discovered (30-page limit)` : ''}
          </div>
        </div>
        <button type="button" className={styles.pdfBtn} onClick={() => downloadSitePdf(report)}>
          <PdfIcon /> Download PDF
        </button>
      </div>

      {report.commonIssues.length > 0 && (
        <section className={styles.group}>
          <h2>Most common issues</h2>
          <BarChart items={report.commonIssues.map((i) => ({ label: i.label, value: i.pages, severity: i.severity }))} max={report.pagesCrawled} />
        </section>
      )}

      {scored.length > 0 && (
        <section className={styles.group}>
          <h2>Score distribution</h2>
          <BarChart items={dist} max={scored.length} />
        </section>
      )}

      <section className={styles.group}>
        <h2>Pages ({report.pagesCrawled}) — worst first</h2>
        <ul className={styles.pageList}>
          {report.pages.map((p) => {
            const path = p.url.replace(/^https?:\/\/[^/]+/, '') || '/'
            const isOpen = open === p.url
            const issues = p.checks.filter((c) => c.severity !== 'good')
            return (
              <li key={p.url} className={styles.pageItem}>
                <button type="button" className={styles.pageRow} onClick={() => setOpen(isOpen ? null : p.url)} disabled={!!p.error}>
                  <span className={`${styles.pageScore} ${p.error ? styles.bad : styles[band(p.score)]}`}>{p.error ? '—' : p.score}</span>
                  <span className={styles.pagePath} title={p.url}>
                    {path}
                  </span>
                  {p.error ? (
                    <span className={styles.pageErr}>unreachable</span>
                  ) : (
                    <span className={styles.pageMini}>
                      <em className={styles.warn}>{p.counts.warning}W</em>
                      <em className={styles.bad}>{p.counts.error}E</em>
                    </span>
                  )}
                </button>
                {isOpen && issues.length > 0 && <FindingsTable items={issues} />}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

export function SeoAudit() {
  const [mode, setMode] = useState<Mode>('page')
  const [url, setUrl] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<AuditReport | null>(null)
  const [siteReport, setSiteReport] = useState<SiteReport | null>(null)
  const [history, setHistory] = useState<AuditSummary[]>([])
  const [siteHistory, setSiteHistory] = useState<SiteSummary[]>([])

  useEffect(() => {
    auditApi.list().then(setHistory).catch(() => {})
    siteAuditApi.list().then(setSiteHistory).catch(() => {})
  }, [])

  async function run() {
    const input = url.trim()
    if (!input || running) return
    setRunning(true)
    setError(null)
    try {
      if (mode === 'site') {
        const r = await siteAuditApi.run(input)
        setSiteReport(r)
        setReport(null)
        setSiteHistory((h) => [{ id: r.id!, site: r.site, pagesCrawled: r.pagesCrawled, avgScore: r.avgScore, createdAt: r.createdAt ?? null }, ...h.filter((x) => x.id !== r.id)])
      } else {
        const r = await auditApi.run(input)
        setReport(r)
        setSiteReport(null)
        setHistory((h) => [{ id: r.id!, url: r.url, finalUrl: r.finalUrl, score: r.score, createdAt: r.createdAt ?? null }, ...h.filter((x) => x.id !== r.id)])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The audit failed.')
    } finally {
      setRunning(false)
    }
  }

  async function openPage(id: string) {
    setError(null)
    try {
      setReport(await auditApi.get(id))
      setSiteReport(null)
      setMode('page')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load that report.')
    }
  }
  async function openSite(id: string) {
    setError(null)
    try {
      setSiteReport(await siteAuditApi.get(id))
      setReport(null)
      setMode('site')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load that report.')
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.wrap}>
        <div className={styles.head}>
          <div>
            <h1>SEO audit</h1>
            <p>Check a single page or crawl a whole site for on-page SEO issues — then export the findings as a PDF you can share.</p>
          </div>
        </div>

        <div className={styles.modes} role="tablist" aria-label="Audit mode">
          <button type="button" role="tab" aria-selected={mode === 'page'} className={`${styles.modeBtn} ${mode === 'page' ? styles.modeOn : ''}`} onClick={() => setMode('page')}>
            Single page
          </button>
          <button type="button" role="tab" aria-selected={mode === 'site'} className={`${styles.modeBtn} ${mode === 'site' ? styles.modeOn : ''}`} onClick={() => setMode('site')}>
            Whole site
          </button>
        </div>

        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault()
            run()
          }}
        >
          <span className={styles.globe} aria-hidden="true">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
            </svg>
          </span>
          <input type="text" inputMode="url" placeholder={mode === 'site' ? 'example.com' : 'example.com/page-to-check'} value={url} onChange={(e) => setUrl(e.target.value)} disabled={running} aria-label="URL to audit" />
          <button type="submit" disabled={running || !url.trim()}>
            {running ? (mode === 'site' ? 'Crawling…' : 'Auditing…') : mode === 'site' ? 'Crawl site' : 'Run audit'}
          </button>
        </form>
        {mode === 'site' && <p className={styles.hint}>Crawls up to 30 pages (via sitemap + internal links). This can take up to a minute.</p>}

        {error && <div className={styles.error}>{error}</div>}

        {running && (
          <div className={styles.skeleton}>
            <span className={styles.spin} aria-hidden="true" />
            {mode === 'site' ? 'Crawling the site and auditing pages…' : 'Fetching the page and running checks…'}
          </div>
        )}

        {!running && report && mode === 'page' && <PageReport report={report} />}
        {!running && siteReport && mode === 'site' && <SiteReportView report={siteReport} />}

        {mode === 'page' && history.length > 0 && (
          <div className={styles.history}>
            <h3>Recent page audits</h3>
            <ul>
              {history.map((h) => (
                <li key={h.id}>
                  <button type="button" className={styles.histOpen} onClick={() => openPage(h.id)}>
                    <span className={`${styles.dot} ${styles[band(h.score)]}`} />
                    <span className={styles.histUrl}>{h.finalUrl || h.url}</span>
                    <span className={styles.histScore}>{h.score}</span>
                  </button>
                  <button type="button" className={styles.histDel} aria-label="Delete audit" onClick={() => auditApi.remove(h.id).then(() => setHistory((x) => x.filter((a) => a.id !== h.id)))}>
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {mode === 'site' && siteHistory.length > 0 && (
          <div className={styles.history}>
            <h3>Recent site crawls</h3>
            <ul>
              {siteHistory.map((h) => (
                <li key={h.id}>
                  <button type="button" className={styles.histOpen} onClick={() => openSite(h.id)}>
                    <span className={`${styles.dot} ${styles[band(h.avgScore)]}`} />
                    <span className={styles.histUrl}>
                      {h.site} · {h.pagesCrawled} pages
                    </span>
                    <span className={styles.histScore}>{h.avgScore}</span>
                  </button>
                  <button type="button" className={styles.histDel} aria-label="Delete crawl" onClick={() => siteAuditApi.remove(h.id).then(() => setSiteHistory((x) => x.filter((a) => a.id !== h.id)))}>
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

const PdfIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
    <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
    <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
  </svg>
)
const TrashIcon = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
  </svg>
)
