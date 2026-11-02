// Builds downloadable PDFs of SEO audits, laid out as a professional report
// (cover, executive-summary table, zebra-striped finding tables, numbered
// sections, branded footer) with jsPDF — crisp, small, and selectable.

import { jsPDF } from 'jspdf'
import type { AuditReport, Category, Severity, SiteReport } from './auditApi'

const INK: [number, number, number] = [23, 26, 31]
const INK2: [number, number, number] = [70, 74, 82]
const MUTE: [number, number, number] = [122, 128, 138]
const NAVY: [number, number, number] = [26, 33, 46]
const TEAL: [number, number, number] = [31, 109, 115]
const LINE: [number, number, number] = [224, 227, 231]
const ZEBRA: [number, number, number] = [244, 246, 248]
const SEV: Record<Severity, [number, number, number]> = {
  good: [31, 150, 90],
  warning: [184, 134, 11],
  error: [209, 67, 67],
}
const SEV_LABEL: Record<Severity, string> = { good: 'PASS', warning: 'WARN', error: 'FAIL' }
const CATEGORY_ORDER: Category[] = ['Indexability', 'Meta', 'Content', 'Social', 'Technical']

function hostOf(u: string): string {
  try {
    return new URL(u).host
  } catch {
    return u
  }
}
function scoreBand(s: number): string {
  return s >= 80 ? 'Good' : s >= 50 ? 'Needs work' : 'Poor'
}
function scoreColor(s: number): [number, number, number] {
  return s >= 80 ? SEV.good : s >= 50 ? SEV.warning : SEV.error
}

type Cell = string | { text?: string; bold?: boolean; color?: [number, number, number]; pill?: Severity; align?: 'right' }
interface Col {
  header: string
  w: number // fraction of content width
  align?: 'right'
}

/** A small layout engine shared by both reports. */
function makeDoc() {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 48
  const contentW = W - M * 2
  const ctx = { doc, W, H, M, contentW, y: 0 }
  return ctx
}

function footer(ctx: ReturnType<typeof makeDoc>, label: string) {
  const { doc, W, H, M } = ctx
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(...LINE).line(M, H - 34, W - M, H - 34)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTE)
    doc.text(label, M, H - 20)
    doc.text(`Page ${p} of ${pages}`, W - M, H - 20, { align: 'right' })
  }
}

function ensure(ctx: ReturnType<typeof makeDoc>, needed: number) {
  if (ctx.y + needed > ctx.H - 56) {
    ctx.doc.addPage()
    ctx.y = ctx.M
  }
}

function cover(ctx: ReturnType<typeof makeDoc>, title: string, domain: string, meta: string, intro: string) {
  const { doc, M, contentW } = ctx
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...TEAL)
  doc.text('SEO AUDIT REPORT', M, 64)
  doc.setFont('helvetica', 'bold').setFontSize(28).setTextColor(...INK)
  doc.text(title, M, 100)
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...TEAL)
  doc.text(domain, M, 124)
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...MUTE)
  doc.text(meta, M, 142)
  doc.setDrawColor(...LINE).line(M, 158, M + contentW, 158)
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...INK2)
  const lines = doc.splitTextToSize(intro, contentW) as string[]
  doc.text(lines, M, 182)
  ctx.y = 182 + lines.length * 13 + 16
}

function section(ctx: ReturnType<typeof makeDoc>, n: number, label: string) {
  ensure(ctx, 42)
  const { doc, M, W } = ctx
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...INK)
  doc.text(`${n}. ${label}`, M, ctx.y)
  ctx.y += 9
  doc.setDrawColor(...LINE).line(M, ctx.y, W - M, ctx.y)
  ctx.y += 18
}

/** Draw a zebra-striped table with a dark header; returns updated y. */
function table(ctx: ReturnType<typeof makeDoc>, cols: Col[], rows: Cell[][]) {
  const { doc, M, contentW } = ctx
  const pad = 8
  const widths = cols.map((c) => c.w * contentW)
  const xs: number[] = []
  let acc = M
  for (const w of widths) {
    xs.push(acc)
    acc += w
  }

  const drawHeader = () => {
    doc.setFillColor(...NAVY).rect(M, ctx.y, contentW, 22, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(255, 255, 255)
    cols.forEach((c, i) => {
      const x = c.align === 'right' ? xs[i] + widths[i] - pad : xs[i] + pad
      doc.text(c.header.toUpperCase(), x, ctx.y + 14, { align: c.align === 'right' ? 'right' : 'left' })
    })
    ctx.y += 22
  }
  drawHeader()

  rows.forEach((row, ri) => {
    const cellLines = row.map((cell, i) => {
      if (cell && typeof cell === 'object' && cell.pill) return ['']
      const text = typeof cell === 'string' ? cell : (cell?.text ?? '')
      return doc.splitTextToSize(text, widths[i] - pad * 2) as string[]
    })
    const rowH = Math.max(24, ...cellLines.map((l) => l.length * 11 + 11))
    if (ctx.y + rowH > ctx.H - 56) {
      doc.addPage()
      ctx.y = ctx.M
      drawHeader()
    }
    if (ri % 2 === 0) {
      doc.setFillColor(...ZEBRA).rect(M, ctx.y, contentW, rowH, 'F')
    }
    row.forEach((cell, i) => {
      if (cell && typeof cell === 'object' && cell.pill) {
        const sev = SEV[cell.pill]
        const py = ctx.y + (rowH - 14) / 2
        doc.setFillColor(...sev).roundedRect(xs[i] + pad, py, 38, 14, 3, 3, 'F')
        doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(255, 255, 255)
        doc.text(SEV_LABEL[cell.pill], xs[i] + pad + 19, py + 9.5, { align: 'center' })
        return
      }
      const bold = typeof cell === 'object' && cell?.bold
      const color = (typeof cell === 'object' && cell?.color) || INK
      const align = typeof cell === 'object' ? cell?.align : undefined
      doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(9).setTextColor(...color)
      const x = align === 'right' ? xs[i] + widths[i] - pad : xs[i] + pad
      doc.text(cellLines[i], x, ctx.y + 15, { align: align === 'right' ? 'right' : 'left' })
    })
    ctx.y += rowH
  })
  doc.setDrawColor(...LINE).line(M, ctx.y, M + contentW, ctx.y)
  ctx.y += 20
}

// ---------------------------------------------------------------------------
// Single-page report
// ---------------------------------------------------------------------------
export function buildAuditPdf(report: AuditReport): { doc: jsPDF; filename: string } {
  const ctx = makeDoc()
  const host = hostOf(report.finalUrl)
  const { good, warning, error, total } = report.counts
  const meta = `Audited ${new Date(report.fetchedAt).toLocaleString()}  ·  HTTP ${report.status}  ·  ${(
    report.elapsedMs / 1000
  ).toFixed(2)}s  ·  ${Math.round(report.pageBytes / 1024)} KB`

  cover(
    ctx,
    'Single Page Audit',
    report.finalUrl,
    meta,
    `This report checks ${host} against ${total} on-page SEO signals across indexability, metadata, content, social sharing and technical health. Each finding below includes what was detected and, where relevant, a recommended fix.`,
  )

  // 1. Executive summary
  section(ctx, 1, 'Executive summary')
  const sc = scoreColor(report.score)
  table(
    ctx,
    [
      { header: 'Signal', w: 0.3 },
      { header: 'Result', w: 0.28 },
      { header: 'Assessment', w: 0.42 },
    ],
    [
      [{ text: 'Overall score', bold: true }, { text: `${report.score} / 100`, bold: true, color: sc }, scoreBand(report.score)],
      ['Checks passed', `${good} of ${total}`, 'Fundamentals in place'],
      ['Warnings', `${warning}`, 'Worth addressing'],
      ['Errors', `${error}`, error ? 'Fix these first' : 'None — great'],
    ],
  )

  // 2..n Findings by category
  let n = 2
  for (const cat of CATEGORY_ORDER) {
    const items = report.checks.filter((c) => c.category === cat)
    if (!items.length) continue
    section(ctx, n++, cat)
    table(
      ctx,
      [
        { header: 'Status', w: 0.12 },
        { header: 'Check', w: 0.24 },
        { header: 'Finding & recommended fix', w: 0.64 },
      ],
      items.map((c) => [
        { pill: c.severity },
        { text: c.label, bold: true },
        c.recommendation ? `${c.detail}  Fix: ${c.recommendation}` : c.detail,
      ]),
    )
  }

  footer(ctx, `${host} · SEO audit by QueryRank`)
  const stamp = new Date(report.fetchedAt).toISOString().slice(0, 10)
  return { doc: ctx.doc, filename: `seo-audit-${host.replace(/[^a-z0-9.-]/gi, '_')}-${stamp}.pdf` }
}

export function downloadAuditPdf(report: AuditReport): void {
  const { doc, filename } = buildAuditPdf(report)
  doc.save(filename)
}

// ---------------------------------------------------------------------------
// Whole-site report
// ---------------------------------------------------------------------------
export function buildSitePdf(report: SiteReport): { doc: jsPDF; filename: string } {
  const ctx = makeDoc()
  const host = hostOf(report.site)
  const { good, warning, error } = report.counts
  const meta = `Crawled ${new Date(report.crawledAt).toLocaleString()}  ·  ${report.pagesCrawled} pages  ·  Avg score ${report.avgScore}/100`

  cover(
    ctx,
    'Site SEO Audit',
    report.site,
    meta,
    `QueryRank crawled ${report.pagesCrawled} page${report.pagesCrawled > 1 ? 's' : ''} of ${host}${
      report.capped ? ` (of ${report.pagesDiscovered} discovered; bounded to 30)` : ''
    } and checked each against the on-page SEO signals below. This report summarizes the site-wide picture, the issues that recur most often, and a page-by-page breakdown with fixes.`,
  )

  // 1. Executive summary
  section(ctx, 1, 'Executive summary')
  const sc = scoreColor(report.avgScore)
  const top = report.commonIssues[0]
  table(
    ctx,
    [
      { header: 'Signal', w: 0.3 },
      { header: 'Result', w: 0.28 },
      { header: 'Assessment', w: 0.42 },
    ],
    [
      [{ text: 'Average score', bold: true }, { text: `${report.avgScore} / 100`, bold: true, color: sc }, scoreBand(report.avgScore)],
      ['Pages crawled', report.capped ? `${report.pagesCrawled} of ${report.pagesDiscovered}` : `${report.pagesCrawled}`, report.capped ? 'Bounded to 30 pages' : 'Full crawl'],
      ['Checks passed', `${good}`, 'Across all pages'],
      ['Warnings', `${warning}`, 'Worth addressing'],
      ['Errors', `${error}`, error ? 'Fix these first' : 'None — great'],
      ['Most common issue', top ? top.label : '—', top ? `Affects ${top.pages} page${top.pages > 1 ? 's' : ''}` : 'No recurring issues'],
    ],
  )

  // 2. Most common issues
  if (report.commonIssues.length) {
    section(ctx, 2, 'Most common issues')
    table(
      ctx,
      [
        { header: 'Status', w: 0.12 },
        { header: 'Issue', w: 0.4 },
        { header: 'Category', w: 0.28 },
        { header: 'Pages', w: 0.2, align: 'right' },
      ],
      report.commonIssues.map((i) => [
        { pill: i.severity },
        { text: i.label, bold: true },
        i.category,
        { text: String(i.pages), align: 'right' },
      ]),
    )
  }

  // 3. Page-by-page
  section(ctx, report.commonIssues.length ? 3 : 2, 'Pages (worst first)')
  for (const p of report.pages) {
    const issues = p.error ? [] : p.checks.filter((c) => c.severity !== 'good')
    ensure(ctx, 36)
    // page header row
    const col = p.error ? SEV.error : scoreColor(p.score)
    ctx.doc.setFillColor(...col).roundedRect(ctx.M, ctx.y - 10, 30, 16, 3, 3, 'F')
    ctx.doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(255, 255, 255)
    ctx.doc.text(p.error ? '—' : String(p.score), ctx.M + 15, ctx.y + 1, { align: 'center' })
    ctx.doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(...INK)
    const path = p.url.replace(/^https?:\/\/[^/]+/, '') || '/'
    ctx.doc.text((ctx.doc.splitTextToSize(path, ctx.contentW - 130) as string[])[0], ctx.M + 40, ctx.y + 1)
    ctx.doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTE)
    ctx.doc.text(
      p.error ? 'unreachable' : issues.length ? `${issues.length} issue${issues.length > 1 ? 's' : ''}` : 'all checks passed',
      ctx.W - ctx.M,
      ctx.y + 1,
      { align: 'right' },
    )
    ctx.y += 16

    if (issues.length) {
      table(
        ctx,
        [
          { header: 'Status', w: 0.12 },
          { header: 'Check', w: 0.24 },
          { header: 'Finding & recommended fix', w: 0.64 },
        ],
        issues.map((c) => [
          { pill: c.severity },
          { text: c.label, bold: true },
          c.recommendation ? `${c.detail}  Fix: ${c.recommendation}` : c.detail,
        ]),
      )
    } else if (p.error) {
      ctx.doc.setFont('helvetica', 'italic').setFontSize(9).setTextColor(...SEV.error)
      ctx.doc.text(p.error, ctx.M + 40, ctx.y + 4)
      ctx.y += 18
    } else {
      ctx.y += 8
    }
  }

  footer(ctx, `${host} · SEO audit by QueryRank`)
  const stamp = new Date(report.crawledAt).toISOString().slice(0, 10)
  return { doc: ctx.doc, filename: `site-audit-${host.replace(/[^a-z0-9.-]/gi, '_')}-${stamp}.pdf` }
}

export function downloadSitePdf(report: SiteReport): void {
  const { doc, filename } = buildSitePdf(report)
  doc.save(filename)
}
