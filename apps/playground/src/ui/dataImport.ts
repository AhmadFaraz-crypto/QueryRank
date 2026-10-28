// Import GSC / GA4 / any CSV (or ZIP-of-CSV) exports and normalize them into the
// same {series, cats} shape the live-data registry uses — so an imported snapshot
// renders through every template like a connected source, with no Google keys.
// Parsing happens entirely in the browser.
//
// The import wizard works on an intermediate per-file, per-column analysis
// (ParsedFile / ImportColumn) so the user can review and adjust the mapping
// before it's committed to a dataset.

import { clearLiveData, setLiveCats, setLiveSeries } from './viz/engine'

export type ImportKind = 'ga4' | 'gsc' | 'csv'

export interface KindDef {
  short: string
  source: string
  tag: string
  bg: string
  name: string
  desc: string
  files: string[]
  how: string[]
}
export const KINDS: Record<ImportKind, KindDef> = {
  ga4: {
    short: 'GA4',
    source: 'Google Analytics 4',
    tag: 'GA4',
    bg: '#F59E0B',
    name: 'Google Analytics 4',
    desc: 'Reports exported from GA4: traffic acquisition, pages, events and more.',
    files: ['Traffic_acquisition.csv', 'Pages_and_screens.csv'],
    how: [
      'In GA4, open Reports and pick a report, e.g. Acquisition › Traffic acquisition.',
      'Set the date range you want (60+ days is best for comparisons).',
      'Click Share this report (↗) › Download file › Download CSV.',
      'Tip: add Date as a dimension in an Exploration to get daily trends.',
    ],
  },
  gsc: {
    short: 'GSC',
    source: 'Google Search Console',
    tag: 'GSC',
    bg: '#4285F4',
    name: 'Google Search Console',
    desc: 'Performance exports: queries, pages, countries, devices and daily totals.',
    files: ['Dates.csv', 'Queries.csv', 'Pages.csv', 'Devices.csv'],
    how: [
      'In Search Console, open Performance › Search results.',
      'Tick Total clicks, Total impressions, Average CTR and Average position.',
      'Click Export › Download CSV — you get a ZIP file.',
      'Drop the ZIP here, or unzip and drop the CSVs (Dates, Queries, Pages…).',
    ],
  },
  csv: {
    short: 'CSV',
    source: 'CSV import',
    tag: 'CSV',
    bg: '#64748B',
    name: 'Any CSV',
    desc: 'Spreadsheets or exports from any tool. You choose what each column means.',
    files: ['sales.csv', 'ads_report.csv'],
    how: [
      'Put one header row at the top (the column names).',
      'Add a date column for trends (2026-10-21 or 10/21/2026 both work).',
      'Text columns become breakdowns, number columns become metrics.',
      'Export as CSV (UTF-8) from Excel, Sheets or your tool.',
    ],
  },
}

export type ColRole = 'date' | 'metric' | 'dim' | 'ignore'
export type ColFmt = 'number' | 'percent' | 'currency' | 'duration'
export type ColAgg = 'sum' | 'avg'
export interface ImportColumn {
  h: string // original header
  role: ColRole
  on: boolean
  name: string // metric display name
  dim: string // breakdown dimension (QUERY/PAGE/…)
  fmt: ColFmt
  agg: ColAgg
  sample: string[]
}
export interface ParsedFile {
  name: string
  label: string
  header: string[]
  rows: string[][]
  cols: ImportColumn[]
  days: number
  range: string
  ok: boolean
  status: 'ok' | 'warn' | 'err'
  note: string
}

export interface ImportSeries {
  vals: number[]
  total: number
  prev: number
  unit: string
  avg: boolean
  target: number
}
export interface ImportedDataset {
  id: string
  name: string
  source: string
  createdAt: number
  series: Record<string, ImportSeries>
  cats: Record<string, Array<[string, number]>>
  report: string[]
}

export const DIM_OPTIONS = ['QUERY', 'PAGE', 'DEVICE', 'COUNTRY', 'CHANNEL', 'CATEGORY', 'ITEM']
/** Colours for each column role — used for the role dot and preview headers. */
export const ROLE_COLOR: Record<ColRole, string> = {
  date: '#2BB3A3',
  metric: '#FF6B5B',
  dim: '#5B54B8',
  ignore: '#C8C3BA',
}

/* ---------------- CSV + ZIP parsing ---------------- */

/** RFC-4180-ish CSV parser (handles quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else q = false
      } else field += c
      continue
    }
    if (c === '"') q = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') field += c
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Extract the .csv entries from a ZIP (GSC exports a ZIP of per-dimension CSVs). */
export async function unzipCsvs(buf: ArrayBuffer): Promise<Array<{ name: string; text: string }>> {
  const dv = new DataView(buf)
  const bytes = new Uint8Array(buf)
  const td = new TextDecoder()
  let eocd = -1
  for (let i = buf.byteLength - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('Not a valid ZIP file')
  const count = dv.getUint16(eocd + 10, true)
  let off = dv.getUint32(eocd + 16, true)
  const out: Array<{ name: string; text: string }> = []
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break
    const method = dv.getUint16(off + 10, true)
    const compSize = dv.getUint32(off + 20, true)
    const nameLen = dv.getUint16(off + 28, true)
    const extraLen = dv.getUint16(off + 30, true)
    const commentLen = dv.getUint16(off + 32, true)
    const localOff = dv.getUint32(off + 42, true)
    const name = td.decode(bytes.subarray(off + 46, off + 46 + nameLen))
    const lhNameLen = dv.getUint16(localOff + 26, true)
    const lhExtraLen = dv.getUint16(localOff + 28, true)
    const start = localOff + 30 + lhNameLen + lhExtraLen
    const comp = bytes.subarray(start, start + compSize)
    if (/\.csv$/i.test(name) && !name.startsWith('__MACOSX')) {
      const data = method === 0 ? comp : method === 8 ? await inflateRaw(comp) : null
      if (data) out.push({ name: name.split('/').pop() || name, text: td.decode(data) })
    }
    off += 46 + nameLen + extraLen + commentLen
  }
  return out
}

/* ---------------- column analysis ---------------- */

const clean = (s: string) => s.trim().toLowerCase()
const titleCase = (s: string) =>
  s
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase())
const isDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{8}$/.test(s) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s)
const isNum = (s: string) =>
  s.trim() !== '' && /\d/.test(s) && !isNaN(parseFloat(s.replace(/[$,%\s]/g, '')))
/** A relative day/row index column (GA4 "Nth day": 0,1,2… or 0000,0001…), used
 *  as the series x-axis rather than mistaken for a numeric metric. */
const isSeqIndex = (vals: string[]) => {
  const ns = vals.map((v) => Number.parseInt(v.trim(), 10))
  if (ns.length < 3 || ns.some((n) => !Number.isFinite(n))) return false
  return ns.every((n, i) => n === i) || ns.every((n, i) => n === i + 1)
}

function knownMetric(h: string): { name: string; fmt: ColFmt; agg: ColAgg } | null {
  if (h === 'clicks' || h.includes('total clicks')) return { name: 'Clicks', fmt: 'number', agg: 'sum' }
  if (h.includes('impression')) return { name: 'Impressions', fmt: 'number', agg: 'sum' }
  if (h.includes('ctr')) return { name: 'CTR', fmt: 'percent', agg: 'avg' }
  if (h.includes('position')) return { name: 'Average Position', fmt: 'number', agg: 'avg' }
  if (h.includes('session') && !h.includes('channel') && !h.includes('source'))
    return { name: 'Sessions', fmt: 'number', agg: 'sum' }
  if (h.includes('qualified lead')) return { name: 'Qualified Leads', fmt: 'number', agg: 'sum' }
  if (h.includes('converted lead')) return { name: 'Converted Leads', fmt: 'number', agg: 'sum' }
  // Keep user metrics distinct — New / Returning / Active are different series.
  if (h.includes('new user')) return { name: 'New Users', fmt: 'number', agg: 'sum' }
  if (h.includes('returning user')) return { name: 'Returning Users', fmt: 'number', agg: 'sum' }
  if (h.includes('user')) return { name: 'Active Users', fmt: 'number', agg: 'sum' }
  if (h.includes('view')) return { name: 'Views', fmt: 'number', agg: 'sum' }
  if (h.includes('engagement rate')) return { name: 'Engagement Rate', fmt: 'percent', agg: 'avg' }
  return null
}
function knownDim(h: string): string | null {
  if (h === 'date' || h.startsWith('date')) return 'DATE'
  if (h.includes('quer')) return 'QUERY'
  if (h.includes('page')) return 'PAGE'
  if (h.includes('device')) return 'DEVICE'
  if (h.includes('countr')) return 'COUNTRY'
  if (h.includes('channel')) return 'CHANNEL'
  return null
}

type Table = { header: string[]; rows: string[][] }
const isBreak = (r: string[]) => !r.length || !r.some((c) => c.trim()) || r[0].startsWith('#')

/**
 * Read every data table out of a CSV (GA4 "overview" exports stack several,
 * separated by blank lines / "# …" comments). Tables with an identical header
 * are de-duplicated, keeping the first — GA4 repeats each block for the current
 * and the comparison period, and we only want the current one.
 */
function readTables(text: string): Table[] {
  const all = parseCsv(text.replace(/^\uFEFF/, ''))
  const tables: Table[] = []
  const seen = new Set<string>()
  let i = 0
  while (i < all.length) {
    if (isBreak(all[i])) {
      i++
      continue
    }
    const header = all[i]
    const rows: string[][] = []
    i++
    for (; i < all.length && !isBreak(all[i]); i++) rows.push(all[i])
    if (!rows.length) continue
    const sig = header.join('|')
    if (seen.has(sig)) continue
    seen.add(sig)
    tables.push({ header, rows })
  }
  return tables
}

/** Read just the first data table (used by sample fixtures + tests). */
function readTable(text: string): Table | null {
  return readTables(text)[0] ?? null
}

const emptyFile = (name: string, label: string, note: string): ParsedFile => ({
  name,
  label,
  header: [],
  rows: [],
  cols: [],
  days: 0,
  range: '',
  ok: false,
  status: 'err',
  note,
})

/** Classify one table (header + rows) into a ParsedFile with per-column roles. */
function classifyTable(name: string, label: string, table: Table): ParsedFile {
  const { header, rows } = table
  let dateTaken = false
  const cols: ImportColumn[] = header.map((h0, ci) => {
    const h = clean(h0)
    const colVals = rows.map((r) => r[ci] ?? '')
    const sample = colVals.slice(0, 40).filter((v) => v.trim() !== '')
    const km = knownMetric(h)
    const kd = knownDim(h)
    let role: ColRole
    let name = ''
    let dim = ''
    let fmt: ColFmt = 'number'
    let agg: ColAgg = 'sum'
    const looksDate = sample.length > 0 && sample.every(isDate)
    // A leading relative-index column (GA4 "Nth day") is the x-axis, not a metric.
    const looksIndex = ci === 0 && !km && isSeqIndex(colVals)
    const looksNum = sample.length > 0 && sample.filter(isNum).length >= sample.length * 0.8
    if ((kd === 'DATE' || looksDate || looksIndex) && !(km && looksNum)) {
      role = dateTaken ? 'ignore' : 'date'
      dateTaken = dateTaken || role === 'date'
    } else if (km && looksNum) {
      // Only a metric if the values are actually numeric — guards against a
      // dimension header that happens to contain a metric word (e.g. "First
      // user primary channel group" matching the "user" rule).
      role = 'metric'
      name = km.name
      fmt = km.fmt
      agg = km.agg
    } else if (kd) {
      role = 'dim'
      dim = kd
    } else if (looksNum) {
      role = 'metric'
      name = titleCase(h0)
      fmt = h.includes('rate') || sample.some((s) => s.includes('%')) ? 'percent' : 'number'
      agg = fmt === 'percent' ? 'avg' : 'sum'
    } else {
      role = 'dim'
      dim = 'CATEGORY'
    }
    return { h: h0, role, on: role !== 'ignore', name, dim, fmt, agg, sample: sample.slice(0, 3) }
  })
  const dateCol = cols.findIndex((c) => c.role === 'date')
  const days = dateCol >= 0 ? rows.length : 0
  let range = ''
  if (dateCol >= 0 && rows.length) {
    const a = rows[0][dateCol]
    const b = rows[rows.length - 1][dateCol]
    range = a && b ? `${a} – ${b}` : ''
  }
  const metrics = cols.filter((c) => c.on && c.role === 'metric').length
  const dims = cols.filter((c) => c.on && c.role === 'dim').length
  // "ok" means the table can actually be charted: metric(s) plus either a time
  // axis (series) or a category column (breakdown). Metrics alone can't render.
  const ok = metrics > 0 && (dateCol >= 0 || dims > 0)
  const status: ParsedFile['status'] = ok ? 'ok' : metrics > 0 || dims > 0 ? 'warn' : 'err'
  const note = ok
    ? `${metrics} metric${metrics === 1 ? '' : 's'}${dateCol >= 0 ? ` · ${days} days` : dims ? ` · by ${cols.find((c) => c.role === 'dim')!.dim.toLowerCase()}` : ''}`
    : metrics > 0
      ? 'Needs a date or category column to chart these numbers'
      : dims > 0
        ? 'No numbers found — only text columns'
        : 'No usable columns'
  return { name, label, header, rows, cols, days, range, ok, status, note }
}

/** Classify the FIRST table of a CSV (used by sample fixtures + tests). */
export function analyzeTable(name: string, text: string): ParsedFile {
  const label = titleCase(name.replace(/\.csv$/i, ''))
  const table = readTable(text)
  return table ? classifyTable(name, label, table) : emptyFile(name, label, 'No readable table')
}

/** Classify EVERY table in a CSV (GA4 "overview" exports stack several). Each
 *  becomes its own reviewable entry, labelled by the metrics it holds. */
function analyzeText(name: string, text: string): ParsedFile[] {
  const base = titleCase(name.replace(/\.csv$/i, ''))
  const tables = readTables(text)
  if (!tables.length) return [emptyFile(name, base, 'No readable table')]
  return tables.map((t) => {
    const section = t.header
      .filter((h) => !/^(nth day|date|index)$/i.test(h.trim()))
      .join(', ')
    const label = tables.length > 1 && section ? `${base} · ${section}` : base
    return classifyTable(label, label, t)
  })
}

/** Analyze one uploaded file (CSV or ZIP) → one ParsedFile per table. */
export async function analyzeFiles(files: File[]): Promise<ParsedFile[]> {
  const out: ParsedFile[] = []
  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      try {
        const entries = await unzipCsvs(await file.arrayBuffer())
        for (const e of entries) out.push(...analyzeText(e.name, e.text))
      } catch {
        out.push(emptyFile(file.name, titleCase(file.name), 'Could not read ZIP'))
      }
    } else {
      out.push(...analyzeText(file.name, await file.text()))
    }
  }
  return out
}

/** Guess which source a file is from (to preselect the wizard). */
export function detectKind(text: string): ImportKind | null {
  const head = clean(parseCsv(text.slice(0, 4000)).flat().join(' '))
  if (/\bctr\b|impressions|\bposition\b/.test(head)) return 'gsc'
  if (/session|engagement rate|active users|screen page views/.test(head)) return 'ga4'
  return null
}

/* ---------------- build + apply ---------------- */

const unitFor = (fmt: ColFmt) => (fmt === 'percent' ? '%' : fmt === 'currency' ? '$' : '')
function colValue(raw: string, col: ImportColumn): number {
  const pct = raw.includes('%')
  const v = parseFloat(String(raw).replace(/[^0-9.-]/g, '')) || 0
  if (col.fmt === 'percent') return pct ? v : v <= 1 ? v * 100 : v
  return v
}
function prettyCat(dim: string, name: string): string {
  const s = name.trim()
  if (dim === 'DEVICE') return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s
  if (dim === 'PAGE') {
    try {
      return new URL(s).pathname || '/'
    } catch {
      return s
    }
  }
  return s
}
/** A series + a within-period trend used as the comparison value. */
function toSeries(vals: number[], avg: boolean, unit: string): ImportSeries {
  const n = vals.length || 1
  const total = avg ? vals.reduce((a, v) => a + v, 0) / n : vals.reduce((a, v) => a + v, 0)
  const h = Math.max(1, Math.floor(n / 2))
  const sum = (a: number[]) => a.reduce((x, v) => x + v, 0) || 1
  const prev = avg
    ? vals.slice(0, h).reduce((a, v) => a + v, 0) / h
    : total * (sum(vals.slice(0, h)) / sum(vals.slice(h)))
  return { vals, total, prev: prev || total, unit, avg, target: total * 1.1 }
}

/** Build the final dataset from the (possibly edited) per-file mapping. */
export function buildFromFiles(
  files: ParsedFile[],
  kind: ImportKind,
  name: string,
  now: number,
): ImportedDataset {
  const ds: ImportedDataset = {
    id: `ds_${now}`,
    name: name || KINDS[kind].source,
    source: KINDS[kind].source,
    createdAt: now,
    series: {},
    cats: {},
    report: [],
  }
  for (const f of files) {
    if (!f.ok) continue
    const metricCols = f.cols
      .map((c, i) => ({ c, i }))
      .filter((x) => x.c.on && x.c.role === 'metric')
    const dimCols = f.cols.map((c, i) => ({ c, i })).filter((x) => x.c.on && x.c.role === 'dim')
    const dateCol = f.cols.findIndex((c) => c.on && c.role === 'date')
    if (dateCol >= 0 && metricCols.length) {
      for (const { c, i } of metricCols)
        // First table wins — GA4 overviews repeat a metric for the comparison
        // period, and several leads metrics alias to the same engine metric.
        if (!ds.series[c.name])
          ds.series[c.name] = toSeries(
            f.rows.map((r) => colValue(r[i] ?? '0', c)),
            c.agg === 'avg',
            unitFor(c.fmt),
          )
      ds.report.push(`${f.name}: ${metricCols.length} daily metric(s)`)
    }
    if (dimCols.length && metricCols.length) {
      for (const d of dimCols)
        for (const { c, i } of metricCols) {
          if (c.agg === 'avg') continue // rates don't sum across a breakdown
          const key = `${c.name}|${d.c.dim}`
          if (ds.cats[key]) continue
          const rows = f.rows
            .map((r): [string, number] => [prettyCat(d.c.dim, r[d.i] ?? ''), colValue(r[i] ?? '0', c)])
            .filter(([n]) => n.trim() !== '')
          if (rows.length) ds.cats[key] = rows
        }
      ds.report.push(
        `${f.name}: ${f.rows.length} rows by ${dimCols.map((d) => d.c.dim.toLowerCase()).join(', ')}`,
      )
    }
  }
  return ds
}

/** Render every imported dataset into the chart registry at once. GSC and GA4
 *  use disjoint metric names, so a GSC and a GA4 import coexist. */
export function applyDatasets(list: ImportedDataset[]): void {
  clearLiveData()
  for (const ds of list) {
    for (const [metric, s] of Object.entries(ds.series)) setLiveSeries(metric, s)
    for (const [key, rows] of Object.entries(ds.cats)) {
      const [metric, dim] = key.split('|')
      setLiveCats(metric, dim, rows)
    }
  }
}

export function datasetSummary(ds: ImportedDataset): string {
  const s = Object.keys(ds.series).length
  const c = Object.keys(ds.cats).length
  return `${s} metric${s === 1 ? '' : 's'}, ${c} breakdown${c === 1 ? '' : 's'}`
}
