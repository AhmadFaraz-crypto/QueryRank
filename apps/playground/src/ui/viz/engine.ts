/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Universal chart engine.
 *
 * `draw(host, type, cfg, opt)` renders any of the 16 chart types into a DOM
 * host as SVG/HTML, reading theme CSS variables (--c1…--c6, --card-*). It's
 * deliberately imperative — the same engine powers the dashboard canvas, the
 * Focus Studio preview, and the chart-type strip thumbnails, so they always
 * match. React components drive it via refs.
 */
import { METRICS } from '../../data/metrics'

const NS = 'http://www.w3.org/2000/svg'
type Attrs = Record<string, string | number>

export function el(
  tag: string,
  attrs: Attrs = {},
  parent?: Element | null,
  text?: string | number,
) {
  const n = document.createElementNS(NS, tag)
  for (const k in attrs) n.setAttribute(k, String(attrs[k]))
  if (text != null) n.textContent = String(text)
  if (parent) parent.appendChild(n)
  return n
}

export const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"]/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string,
  )

/* ---------- metric library adapter ---------- */
const LIB = METRICS.map((m) => ({
  n: m.name,
  s: m.sourceLabel,
  src: m.primarySource,
  v: m.value,
}))
export { LIB as METRIC_LIB }

/* ---------- live data registry ----------
 * When a real source is connected, the resolver injects live values here keyed
 * by metric name (series) and `name|dimension` (breakdowns). seriesFor/catsFor
 * consult this first and fall back to the synthetic demo generators, so every
 * dashboard shows dummy data until its source goes live. */
export interface LiveSeries {
  vals: number[]
  total: number
  prev: number
  unit: string
  avg: boolean
  target: number
}
// Range-agnostic store: CSV imports (a fixed dataset) and tests register here,
// and it serves every date range.
const LIVE_SERIES = new Map<string, LiveSeries>()
const LIVE_CATS = new Map<string, Array<[string, number]>>()
// Range-keyed store: live GSC/GA4 data, keyed by `${days}|${name}` so different
// cards on different date ranges each get the window they asked for.
const LIVE_SERIES_R = new Map<string, LiveSeries>()
const LIVE_CATS_R = new Map<string, Array<[string, number]>>()

export function setLiveSeries(name: string, data: LiveSeries): void {
  LIVE_SERIES.set(name, data)
}
export function setLiveCats(
  name: string,
  dim: string,
  cats: Array<[string, number]>,
): void {
  LIVE_CATS.set(`${name}|${dim}`, cats)
}
/** Register live series for a specific window (days). Used by the GSC/GA4 resolver. */
export function setLiveSeriesForRange(days: number, name: string, data: LiveSeries): void {
  LIVE_SERIES_R.set(`${days}|${name}`, data)
}
export function setLiveCatsForRange(
  days: number,
  name: string,
  dim: string,
  cats: Array<[string, number]>,
): void {
  LIVE_CATS_R.set(`${days}|${name}|${dim}`, cats)
}
/** True once at least one live series has been loaded for the given window. */
export function hasLiveRange(days: number): boolean {
  const suffix = `${days}|`
  for (const k of LIVE_SERIES_R.keys()) if (k.startsWith(suffix)) return true
  return false
}
/** Metric names that currently have live data (to badge them as live in the UI). */
export function liveMetricNames(): Set<string> {
  const names = new Set(LIVE_SERIES.keys())
  for (const k of LIVE_SERIES_R.keys()) names.add(k.slice(k.indexOf('|') + 1))
  return names
}
export function clearLiveData(): void {
  LIVE_SERIES.clear()
  LIVE_CATS.clear()
  LIVE_SERIES_R.clear()
  LIVE_CATS_R.clear()
}
/** Clear only the range-keyed live store (GSC/GA4), leaving CSV imports intact. */
export function clearLiveRanges(): void {
  LIVE_SERIES_R.clear()
  LIVE_CATS_R.clear()
}

/* ---------- visualization icons ---------- */
const I = (p: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`
const VIZ: Array<{ k: string; svg: string }> = [
  {
    k: 'number',
    svg: I(
      '<path d="M5 9h2v8M4 17h4M10 10a2 2 0 114 0c0 2-4 3-4 7h4M16 9h3l-2 3a2.5 2.5 0 11-1.5 4.5"/>',
    ),
  },
  { k: 'line', svg: I('<path d="M3 3v18h18"/><path d="M6 15l4-5 4 3 5-7"/>') },
  {
    k: 'bar',
    svg: I('<path d="M3 3v18h18"/><path d="M7 17v-6M11 17V7M15 17v-8M19 17v-4"/>'),
  },
  { k: 'pie', svg: I('<circle cx="12" cy="12" r="8"/><path d="M12 4v8l6 5"/>') },
  {
    k: 'table',
    svg: I(
      '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 4v16"/>',
    ),
  },
  {
    k: 'pipeline',
    svg: I('<path d="M4 5l5 2v10l-5 2zM9 7l5 2v6l-5 2M14 9l5 2v2l-5 2"/>'),
  },
  { k: 'funnel', svg: I('<path d="M3 5h18l-7 8v6l-4-2v-4z"/>') },
  {
    k: 'heatmap',
    svg: I(
      '<rect x="4" y="4" width="4" height="4" rx="1"/><rect x="10" y="4" width="4" height="4" rx="1" fill="currentColor"/><rect x="16" y="4" width="4" height="4" rx="1"/><rect x="4" y="10" width="4" height="4" rx="1" fill="currentColor"/><rect x="10" y="10" width="4" height="4" rx="1"/><rect x="16" y="10" width="4" height="4" rx="1" fill="currentColor"/><rect x="4" y="16" width="4" height="4" rx="1"/><rect x="10" y="16" width="4" height="4" rx="1" fill="currentColor"/><rect x="16" y="16" width="4" height="4" rx="1"/>',
    ),
  },
  {
    k: 'progress',
    svg: I(
      '<rect x="3" y="10" width="18" height="5" rx="2.5"/><path d="M5.5 12.5h9" stroke-width="3"/>',
    ),
  },
  {
    k: 'radial',
    svg: I(
      '<circle cx="12" cy="12" r="8" opacity=".35"/><path d="M12 4a8 8 0 017 12"/><circle cx="12" cy="12" r="4" opacity=".35"/><path d="M12 8a4 4 0 014 4"/>',
    ),
  },
  { k: 'gauge', svg: I('<path d="M4 16a8 8 0 0116 0"/><path d="M12 16l4-4"/>') },
  { k: 'hbar', svg: I('<path d="M3 3v18"/><path d="M7 7h8M7 12h12M7 17h5"/>') },
  {
    k: 'spider',
    svg: I(
      '<path d="M12 3l9 6.5-3.5 10.5h-11L3 9.5z"/><path d="M12 8l4.5 3.3-1.7 5.2H9.2l-1.7-5.2z"/>',
    ),
  },
  {
    k: 'bubble',
    svg: I(
      '<circle cx="8" cy="8" r="3.5"/><circle cx="16" cy="15" r="4.5"/><circle cx="7" cy="17" r="2"/>',
    ),
  },
]
export const vizSvg = (k: string) => (VIZ.find((v) => v.k === k) || VIZ[0]).svg

export const TYPES: Array<[string, string]> = [
  ['number', 'Number'],
  ['line', 'Line'],
  ['bar', 'Bar'],
  ['hbar', 'Horizontal bar'],
  ['pie', 'Donut'],
  ['table', 'Table'],
  ['gauge', 'Gauge'],
  ['progress', 'Progress'],
  ['radial', 'Radial'],
  ['funnel', 'Funnel'],
  ['pipeline', 'Pipeline'],
  ['heatmap', 'Heatmap'],
  ['bubble', 'Bubble'],
  ['spider', 'Spider'],
]
export const typeName = (k: string) => (TYPES.find((t) => t[0] === k) || TYPES[0])[1]

/* ---------- source badge ---------- */
const SRC: Record<string, { bg: string; t: string }> = {
  'Sample dataset': { bg: '#1f7a45', t: 'S' },
  'Google Search Console': { bg: '#4285f4', t: 'S' },
  'Google Analytics 4': { bg: '#e37400', t: 'G' },
}
export const badge = (s: string) => SRC[s] || { bg: '#94A3B8', t: s[0] }

/* ---------- sample data ---------- */
const SHAPES: Record<string, number[]> = {
  Profit: [
    18, 30, 22, 26, 14, 34, 20, 38, 24, 30, 18, 36, 22, 26, 32, 20, 28, 16, 24, 30, 14,
    22, 28, 18, 26, 20, 40, 26, 22, 30,
  ],
  Revenue: [
    44, 44, 67, 39, 60, 57, 33, 69, 39, 22, 14, 16, 26, 14, 66, 29, 42, 21, 32, 44, 46,
    11, 27, 44, 15, 34, 13, 15, 39, 67,
  ],
  Orders: [
    1, 2, 0, 1, 3, 1, 0, 2, 1, 1, 2, 0, 1, 1, 3, 1, 0, 1, 2, 1, 1, 0, 2, 1, 1, 0, 1, 2, 1,
    1,
  ],
  AOV: [
    27, 31, 29, 33, 26, 30, 28, 32, 29, 31, 27, 30, 29, 34, 28, 30, 31, 27, 29, 32, 28,
    30, 29, 31, 28, 33, 29, 30, 28, 29,
  ],
}
const BASE: Record<string, any> = {
  Profit: { unit: '$', total: 795.6, prev: 980.1, shape: SHAPES.Profit },
  Revenue: { unit: '$', total: 1089, prev: 1344, shape: SHAPES.Revenue },
  Orders: { unit: '', total: 30, prev: 30, shape: SHAPES.Orders },
  'Average Order Value': {
    unit: '$',
    total: 29.47,
    prev: 31.2,
    shape: SHAPES.AOV,
    avg: true,
    target: 33.36,
  },
  Quantity: {
    unit: '',
    total: 45,
    prev: 52,
    shape: SHAPES.Orders.map((v) => v * 1.5 + 0.5),
  },
  Clicks: {
    unit: '',
    total: 12480,
    prev: 10950,
    shape: SHAPES.Revenue.map((v) => v + 30),
  },
  Impressions: {
    unit: '',
    total: 386200,
    prev: 351400,
    shape: SHAPES.Profit.map((v) => v + 25),
  },
  CTR: { unit: '%', total: 3.23, prev: 3.12, shape: SHAPES.AOV, avg: true, target: 4 },
  'Average Position': {
    unit: '',
    total: 8.4,
    prev: 9.1,
    shape: SHAPES.AOV,
    avg: true,
    target: 5,
  },
  // Google Analytics 4
  Sessions: {
    unit: '',
    total: 42800,
    prev: 39100,
    shape: SHAPES.Revenue.map((v) => v + 30),
  },
  'Active Users': {
    unit: '',
    total: 31200,
    prev: 28600,
    shape: SHAPES.Profit.map((v) => v + 20),
  },
  Views: {
    unit: '',
    total: 128400,
    prev: 119200,
    shape: SHAPES.Revenue.map((v) => v + 40),
  },
  'Engagement Rate': {
    unit: '%',
    total: 62.4,
    prev: 58.9,
    shape: SHAPES.AOV,
    avg: true,
    target: 70,
  },
  'New Users': {
    unit: '',
    total: 1240,
    prev: 1100,
    shape: SHAPES.Profit.map((v) => v + 12),
  },
  'Returning Users': {
    unit: '',
    total: 860,
    prev: 800,
    shape: SHAPES.Revenue.map((v) => v + 8),
  },
  'Qualified Leads': {
    unit: '',
    total: 320,
    prev: 280,
    shape: SHAPES.Orders.map((v) => v * 8 + 2),
  },
  'Converted Leads': {
    unit: '',
    total: 94,
    prev: 78,
    shape: SHAPES.Orders.map((v) => v * 2 + 1),
  },
}
const DIMS: Record<string, string[]> = {
  ITEM: [
    'Smart Fitness Tracker',
    'Bamboo Cutting Board Set',
    'Electric Wine Opener',
    'Indoor Herb Garden Kit',
    'Foldable Laptop Stand',
  ],
  CATEGORY: [
    'Kitchen Appliances',
    'Health & Wellness',
    'Electronics',
    'Home & Lifestyle',
    'Outdoor & Adventure',
  ],
  CHANNEL: ['eBay', 'Facebook', 'Etsy', 'Amazon', 'Website', 'Offline'],
  QUERY: [
    'fitness tracker',
    'bamboo cutting board',
    'electric wine opener',
    'herb garden kit',
    'laptop stand',
  ],
  PAGE: [
    '/products/fitness-tracker',
    '/blog/kitchen-gifts',
    '/collections/home',
    '/products/wine-opener',
    '/',
  ],
  DEVICE: ['Mobile', 'Desktop', 'Tablet'],
  COUNTRY: [
    'United States',
    'United Kingdom',
    'India',
    'Germany',
    'Canada',
    'Australia',
  ],
}
const REAL: Record<string, Record<string, number[]>> = {
  ITEM: { Revenue: [240, 117, 90, 78, 44], Quantity: [16, 13, 6, 6, 4] },
  CATEGORY: { Quantity: [26, 20, 11, 10, 1] },
  CHANNEL: { Profit: [240, 220, 210, 160, 40, 10] },
}
const WEIGHTS: Record<string, number[]> = {
  ITEM: [34, 22, 17, 15, 12],
  CATEGORY: [38, 28, 16, 14, 4],
  CHANNEL: [27, 25, 23, 18, 5, 2],
  QUERY: [31, 24, 19, 15, 11],
  PAGE: [29, 23, 20, 16, 12],
  DEVICE: [61, 33, 6],
  COUNTRY: [42, 16, 13, 11, 9, 9],
}

export const RANGES: Array<[string, string, number]> = [
  ['Last7', '7 days', 7],
  ['LastX', '30 days', 30],
  ['Last90', '90 days', 90],
  ['MonthToDate', 'Month to date', 19],
  ['QuarterToDate', 'Quarter to date', 19],
  ['YearToDate', 'Year to date', 292],
]

/** Grouped date ranges for the per-card date picker (Popular / Current /
 *  Previous). `days` only shapes the dummy series length + scale; live data
 *  ignores it. A custom range is encoded as `cust:<n>` where n is the day span. */
export interface DateItem {
  key: string
  label: string
  days: number
}
export const DATE_GROUPS: Array<{ group: string; items: DateItem[] }> = [
  {
    group: 'Popular',
    items: [
      { key: 'Last7', label: 'Last 7 days', days: 7 },
      { key: 'Last14', label: 'Last 14 days', days: 14 },
      { key: 'Last28', label: 'Last 28 days', days: 28 },
      { key: 'LastX', label: 'Last 30 days', days: 30 },
      { key: 'Last90', label: 'Last 90 days', days: 90 },
      { key: 'Last365', label: 'Last 12 months', days: 365 },
    ],
  },
  {
    group: 'Current',
    items: [
      { key: 'WeekToDate', label: 'This week', days: 5 },
      { key: 'MonthToDate', label: 'This month', days: 19 },
      { key: 'QuarterToDate', label: 'This quarter', days: 52 },
      { key: 'YearToDate', label: 'This year', days: 292 },
    ],
  },
  {
    group: 'Previous',
    items: [
      { key: 'PrevWeek', label: 'Last week', days: 7 },
      { key: 'PrevMonth', label: 'Last month', days: 30 },
      { key: 'PrevQuarter', label: 'Last quarter', days: 90 },
      { key: 'PrevYear', label: 'Last year', days: 365 },
    ],
  },
]

const DATE_LOOKUP: Record<string, DateItem> = Object.fromEntries(
  DATE_GROUPS.flatMap((g) => g.items).map((it) => [it.key, it]),
)
const customDays = (r: string) => {
  const n = parseInt(r.slice(5), 10)
  return Number.isFinite(n) && n > 0 ? Math.min(730, n) : 30
}
export const rangeDays = (r: string) =>
  r.startsWith('cust:') ? customDays(r) : (DATE_LOOKUP[r]?.days ?? 30)
export const rangeName = (r: string) =>
  r.startsWith('cust:') ? 'Custom range' : (DATE_LOOKUP[r]?.label ?? 'Last 30 days')

const PALETTE_ALT = [
  'var(--c1)',
  'var(--c2)',
  'var(--c3)',
  'var(--c4)',
  'var(--c5)',
  'var(--c6)',
]

function baseFor(name: string): any {
  if (BASE[name]) return BASE[name]
  const m = LIB.find((x) => x.n === name) || { v: '1,000' }
  const raw = parseFloat(String(m.v).replace(/[$,%\s]/g, '')) || 100
  const seed = [...name].reduce((s, ch) => s + ch.charCodeAt(0), 0)
  const shape = Array.from(
    { length: 30 },
    (_, i) => 20 + 14 * Math.sin(i / 3 + seed) + ((seed * (i + 7)) % 11),
  )
  return {
    unit: String(m.v).startsWith('$') ? '$' : String(m.v).endsWith('%') ? '%' : '',
    total: raw,
    prev: raw * (1 + ((seed % 9) - 4) / 20),
    shape,
    avg: String(m.v).endsWith('%'),
  }
}
function seriesFor(name: string, range: string): any {
  const days = rangeDays(range)
  // Prefer live data for this exact window, then the range-agnostic store (CSV
  // imports). Only use it if it has points — a connected account with very low
  // traffic can return an empty/short series, which would crash charts that
  // index into it; fall back to the sample shape in that case.
  const live = LIVE_SERIES_R.get(`${days}|${name}`) ?? LIVE_SERIES.get(name)
  if (live && Array.isArray(live.vals) && live.vals.length) return live
  const b = baseFor(name)
  let vals: number[] = []
  for (let i = 0; i < days; i++) {
    const s = b.shape[(b.shape.length - (days % b.shape.length) + i) % b.shape.length]
    vals.push(s * (1 + 0.08 * Math.sin(i * 1.7)))
  }
  if (b.avg) {
    const mean = vals.reduce((a, v) => a + v, 0) / vals.length
    vals = vals.map((v) => (v / mean) * b.total)
  } else {
    const sum = vals.reduce((a, v) => a + v, 0),
      goal = (b.total * days) / 30
    vals = vals.map((v) => (v / sum) * goal)
  }
  const total = b.avg ? b.total : vals.reduce((a, v) => a + v, 0)
  const ratio = b.avg ? 1 : total / b.total
  const target = b.target ? b.target : b.avg ? b.total * 1.15 : b.prev * ratio * 1.1
  return {
    vals,
    total,
    prev: b.prev * ratio,
    unit: b.unit,
    avg: !!b.avg,
    target,
  }
}
function catsFor(
  name: string,
  dim: string,
  range: string,
  total: number,
  avg: boolean,
): Array<[string, number]> {
  const days = rangeDays(range)
  const live = LIVE_CATS_R.get(`${days}|${name}|${dim}`) ?? LIVE_CATS.get(`${name}|${dim}`)
  // An empty array is truthy — guard its length so a breakdown the connected
  // account has no data for (e.g. no queries yet) falls back to sample rows
  // instead of handing every chart an empty list to index into.
  if (live && live.length) return live
  const k = days / 30
  const names = DIMS[dim]
  if (REAL[dim] && REAL[dim][name])
    return names.map((n, i) => [n, REAL[dim][name][i] * (avg ? 1 : k)])
  const w = WEIGHTS[dim],
    sw = w.reduce((a, v) => a + v, 0) || 1
  return names.map((n, i) => [n, avg ? total * (0.75 + (w[i] / sw) * 1.5) : (total * w[i]) / sw])
}

export function blockData(c: BlockConfig): any {
  const ms = c.metrics.map((m, i) => {
    const s = seriesFor(m.name, c.date)
    const cats = m.breakdown ? catsFor(m.name, m.breakdown, c.date, s.total, s.avg) : null
    return {
      ...s,
      name: m.label || m.name,
      metric: m.name,
      cats,
      color: i === 0 ? null : PALETTE_ALT[i % PALETTE_ALT.length],
      compare: m.compare,
    }
  })
  const p = ms[0]
  if (!p) return null
  let cats = p.cats
  if (!cats) {
    const per = Math.max(1, Math.ceil(p.vals.length / 5)),
      out: Array<[string, number]> = []
    for (let i = 0; i < p.vals.length; i += per) {
      const ch = p.vals.slice(i, i + per)
      out.push([
        `Week ${out.length + 1}`,
        p.avg
          ? ch.reduce((a: number, v: number) => a + v, 0) / ch.length
          : ch.reduce((a: number, v: number) => a + v, 0),
      ])
    }
    cats = out
  }
  if (c.sort && c.sort !== 'none') {
    const [k, o] = c.sort.split('-')
    cats = [...cats].sort((a: any, b: any) => {
      const r = k === 'name' ? a[0].localeCompare(b[0]) : a[1] - b[1]
      return o === 'asc' ? r : -r
    })
  }
  return { ms, p, cats, hasBreakdown: !!p.cats }
}

/* ---------- number formatting ---------- */
export function fmt(v: number, unit: string, c?: BlockConfig, axis?: boolean): string {
  const f = (c && c.fmt) || 'full'
  let s: string
  if (f === 'compact' || (axis && Math.abs(v) >= 1000))
    s = Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(v)
  else if (
    (f === 'round' || axis || unit === '') &&
    !(Math.abs(v) < 100 && !Number.isInteger(+v.toFixed(1)) && !axis)
  )
    s = Math.round(v).toLocaleString('en-US')
  else if (unit === '' || unit === '%') s = v.toFixed(1)
  else
    s = v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return unit === '$' ? '$' + s : unit === '%' ? s + '%' : s
}
const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0)
const LOWER_IS_BETTER = new Set(['Average Position'])
const deltaPill = (cur: number, prev: number, invert?: boolean) => {
  const d = pct(cur, prev),
    good = invert ? d < 0 : d > 0,
    cls = Math.abs(d) < 0.5 ? 'flat' : good ? 'pos' : 'neg'
  return `<span class="dp ${cls}">${cls === 'flat' ? '' : d < 0 ? '↓ ' : '↑ '}${Math.abs(d).toFixed(0)}%</span>`
}

/** Tooltip change line vs a comparison value: { sub, dir } for data-tip-sub/dir.
 *  `invert` flips good/bad direction for lower-is-better metrics (e.g. position),
 *  which only affects the up/down colour, not the arrow. */
const trendTip = (cur: number, prev: number | undefined, label = 'vs prev') => {
  if (prev == null || !Number.isFinite(prev) || prev === 0) return { sub: '', dir: '' }
  const d = pct(cur, prev)
  if (Math.abs(d) < 0.5) return { sub: `→ flat ${label}`, dir: 'flat' }
  const up = d > 0
  return { sub: `${up ? '↑' : '↓'} ${Math.abs(d).toFixed(0)}% ${label}`, dir: up ? 'up' : 'down' }
}

/* ---------- svg helpers ---------- */
const gradDef = (svg: Element, x2 = 0, y2 = 1, a = 'var(--c1)', b = 'var(--g1)') => {
  const id = 'g' + Math.random().toString(36).slice(2, 8)
  const defs = svg.querySelector('defs') || el('defs', {}, svg)
  const g = el('linearGradient', { id, x1: 0, y1: 0, x2, y2 }, defs)
  el('stop', { offset: 0, style: `stop-color:${a}` }, g)
  el('stop', { offset: 1, style: `stop-color:${b}` }, g)
  return `url(#${id})`
}
const svgEl = (host: Element, W: number, H: number) =>
  el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%' }, host)
const T = (svg: Element, x: number, y: number, txt: string | number, a: Attrs = {}) =>
  el('text', { x, y, 'font-size': 12, fill: 'var(--card-muted)', ...a }, svg, txt)
function smoothPath(pts: number[][]) {
  if (pts.length < 3) return 'M' + pts.map((p) => p.join(' ')).join(' L')
  let d = `M${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1] || pts[i],
      [x1, y1] = pts[i],
      [x2, y2] = pts[i + 1],
      [x3, y3] = pts[i + 2] || pts[i + 1]
    d += ` C${x1 + (x2 - x0) / 6} ${y1 + (y2 - y0) / 6} ${x2 - (x3 - x1) / 6} ${y2 - (y3 - y1) / 6} ${x2} ${y2}`
  }
  return d
}

/* ---------- block config ---------- */
export interface BlockMetric {
  name: string
  label: string
  source: string
  breakdown: string
  compare: string
  small: boolean
  filters: Array<{ dim: string; op: string; value: string }>
}
export interface BlockConfig {
  id: string
  title: string
  type: string
  date: string
  size: number
  /** Row span (height in grid rows). Defaults to 1; e.g. 2 for a tall chart. */
  h?: number
  metrics: BlockMetric[]
  series: number | null
  custom: [string, string] | null
  bg: number
  legend: boolean
  grid: boolean
  labels: boolean
  smooth: boolean
  rounded: boolean
  gradText: boolean
  fz: number
  fmt: string
  sort: string
  fav: boolean
}

const PRESET: Record<
  string,
  {
    type: string
    metrics: Array<[string, string?]>
    size: number
    grid?: boolean
    legend?: boolean
  }
> = {
  Profit: { type: 'number', metrics: [['Profit']], size: 3 },
  Revenue: { type: 'bar', metrics: [['Revenue']], size: 6, grid: true },
  Orders: { type: 'number', metrics: [['Orders']], size: 3 },
  'Average Order Value': { type: 'gauge', metrics: [['Average Order Value']], size: 3 },
  'Top 5 Selling Items': {
    type: 'table',
    metrics: [
      ['Revenue', 'ITEM'],
      ['Quantity', 'ITEM'],
    ],
    size: 5,
  },
  'Profit per Channel': {
    type: 'bubble',
    metrics: [['Profit', 'CHANNEL']],
    size: 4,
    legend: true,
  },
  'Items sold per Category': {
    type: 'hbar',
    metrics: [['Quantity', 'CATEGORY']],
    size: 6,
  },
}
let blockSeq = 0
export function makeBlock(
  title: string,
  overrides: Partial<BlockConfig> = {},
): BlockConfig {
  const pr = PRESET[title] || {
    type: 'number',
    metrics: [[title]] as Array<[string, string?]>,
    size: 3,
  }
  return {
    id: `b${blockSeq++}`,
    title,
    type: pr.type,
    date: 'LastX',
    size: pr.size || 3,
    metrics: pr.metrics.map(([name, breakdown]) => ({
      name,
      label: name,
      source: (LIB.find((m) => m.n === name) || { s: 'Sample dataset' }).s,
      breakdown: breakdown || '',
      compare: 'Previous',
      small: true,
      filters: [],
    })),
    series: null,
    custom: null,
    bg: 0,
    legend: !!pr.legend,
    grid: pr.grid !== false,
    labels: true,
    smooth: true,
    rounded: true,
    gradText: false,
    fz: 100,
    fmt: 'full',
    sort: 'none',
    fav: false,
    ...overrides,
  }
}
/** The 8 default dashboard blocks. */
export const defaultBlocks = (): BlockConfig[] =>
  Object.keys(PRESET).map((t) => makeBlock(t))

/** A metric config for a block. */
export function metricCfg(name: string, breakdown = '', label?: string): BlockMetric {
  return {
    name,
    label: label ?? name,
    source: (LIB.find((m) => m.n === name) || { s: 'Sample dataset' }).s,
    breakdown,
    compare: 'Previous',
    small: true,
    filters: [],
  }
}

/** Creates a full block from a partial config (fills defaults + a fresh id). */
export function makeBlockFrom(partial: Partial<BlockConfig>): BlockConfig {
  return {
    id: `b${blockSeq++}`,
    title: '',
    type: 'number',
    date: 'LastX',
    size: 3,
    metrics: [],
    series: null,
    custom: null,
    bg: 0,
    legend: false,
    grid: true,
    labels: true,
    smooth: true,
    rounded: true,
    gradText: false,
    fz: 100,
    fmt: 'full',
    sort: 'none',
    fav: false,
    ...partial,
  }
}

/** A sensible sample block for a chart type (used when adding from the Charts pane). */
export function blockFromType(k: string): BlockConfig {
  const catTypes = [
    'hbar',
    'table',
    'bubble',
    'spider',
    'pie',
    'funnel',
    'pipeline',
    'radial',
  ]
  const metric = ['gauge', 'progress'].includes(k)
    ? 'Average Order Value'
    : catTypes.includes(k)
      ? 'Profit'
      : 'Revenue'
  return makeBlockFrom({
    title: '',
    type: k,
    size: 3,
    metrics: [metricCfg(metric, catTypes.includes(k) ? 'CHANNEL' : '')],
    legend: false,
    grid: false,
    labels: false,
    fmt: 'compact',
  })
}

/** A KPI number block for a metric (used when adding from the Metrics pane). */
/** Unique data sources referenced by a set of blocks. */
export function dashSources(blocks: BlockConfig[]): string[] {
  return [
    ...new Set(
      blocks.flatMap((b) => b.metrics.map((m) => m.source.split(',')[0].trim())),
    ),
  ]
}

/* ---------- per-block styling (series colour + background) ---------- */
const CARD: Record<string, any> = {
  solid: {
    bg: '#FFFFFF',
    ink: '#111827',
    ink2: '#4B5563',
    muted: '#8A919E',
    line: '#EEF0F3',
    chip: '#F6F7F9',
    track: '#EEF0F3',
    blur: 'none',
    shadow: '0 1px 2px rgba(16,24,40,.06)',
    neg: '#B42318',
  },
  glass: {
    bg: 'rgba(255,255,255,.14)',
    ink: '#FFFFFF',
    ink2: 'rgba(255,255,255,.85)',
    muted: 'rgba(255,255,255,.68)',
    line: 'rgba(255,255,255,.22)',
    chip: 'rgba(255,255,255,.12)',
    track: 'rgba(255,255,255,.16)',
    blur: 'blur(16px)',
    shadow: '0 8px 30px rgba(0,0,0,.12)',
    neg: '#FFB4B6',
  },
}
function cardVars(style: string) {
  const s = CARD[style]
  return {
    '--card-bg': s.bg,
    '--card-ink': s.ink,
    '--card-ink-2': s.ink2,
    '--card-muted': s.muted,
    '--card-line': s.line,
    '--card-chip': s.chip,
    '--track': s.track,
    '--card-blur': s.blur,
    '--card-shadow': s.shadow,
    '--neg-ink': s.neg,
  }
}
function hexRgb(h: string) {
  h = h.replace('#', '')
  if (h.length === 3)
    h = h
      .split('')
      .map((x) => x + x)
      .join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function lum(h: string) {
  const [r, g, b] = hexRgb(h).map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const GRAD_STOPS: Record<string, Array<[string, number]>> = {
  Aurora: [
    ['#6366F1', 0],
    ['#A855F7', 50],
    ['#EC4899', 100],
  ],
  Ocean: [
    ['#0EA5E9', 0],
    ['#6366F1', 100],
  ],
  Sunset: [
    ['#F97316', 0],
    ['#EC4899', 100],
  ],
  Forest: [
    ['#3F8A34', 0],
    ['#185A43', 60],
    ['#0F4A3E', 100],
  ],
  Midnight: [
    ['#0F172A', 0],
    ['#312E81', 100],
  ],
  Royal: [
    ['#1E3A8A', 0],
    ['#7C3AED', 100],
  ],
  Peach: [
    ['#FFE1C9', 0],
    ['#FBC2EB', 100],
  ],
  Mint: [
    ['#D4FC79', 0],
    ['#96E6A1', 100],
  ],
  Sky: [
    ['#E0F2FE', 0],
    ['#EDE9FE', 100],
  ],
  Rose: [
    ['#FFE4E6', 0],
    ['#FDA4AF', 100],
  ],
  Twilight: [
    ['#312E81', 0],
    ['#9D174D', 100],
  ],
  Lemonade: [
    ['#FEF9C3', 0],
    ['#FED7AA', 100],
  ],
  Ember: [
    ['#7C2D12', 0],
    ['#BE185D', 100],
  ],
  Lagoon: [
    ['#ECFEFF', 0],
    ['#CCFBF1', 50],
    ['#E0E7FF', 100],
  ],
}
const gradCss = (stops: Array<[string, number]>, angle = 135) =>
  `linear-gradient(${angle}deg, ${stops.map(([c, p]) => `${c} ${p}%`).join(', ')})`
export interface BlockBg {
  n: string
  css: string | null
  dark?: boolean
}
export const BLOCK_BGS: BlockBg[] = [
  { n: 'Theme default', css: null },
  { n: 'White', css: '#FFFFFF', dark: false },
  { n: 'Ink', css: '#111827', dark: true },
  ...Object.keys(GRAD_STOPS).map((n) => {
    const st = GRAD_STOPS[n]
    return {
      n,
      css: gradCss(st),
      dark: st.reduce((s, [c]) => s + lum(c), 0) / st.length < 0.35,
    }
  }),
]
export const SERIES: Array<[string, string]> = [
  ['#FF6B5B', '#FFA36C'],
  ['#1E1B4B', '#5B54B8'],
  ['#3B5BDB', '#9AA9FF'],
  ['#7C3AED', '#E879F9'],
  ['#F97316', '#EC4899'],
  ['#0EA5E9', '#6366F1'],
  ['#22C55E', '#14B8A6'],
  ['#F43F5E', '#FB923C'],
  ['#06B6D4', '#A78BFA'],
  ['#EAB308', '#F97316'],
  ['#111827', '#64748B'],
  ['#FFFFFF', '#C7D2FE'],
  ['#14B8A6', '#A3E635'],
  ['#EC4899', '#8B5CF6'],
]
function setVars(node: HTMLElement, vars: Record<string, string>) {
  for (const k in vars) node.style.setProperty(k, vars[k])
}
/** Applies a block's background + series colour overrides onto its card element. */
export function styleBlock(card: HTMLElement, c: BlockConfig) {
  ;[
    '--card-bg',
    '--card-ink',
    '--card-ink-2',
    '--card-muted',
    '--card-line',
    '--card-chip',
    '--track',
    '--card-blur',
    '--card-shadow',
    '--neg-ink',
    '--c1',
    '--g1',
  ].forEach((v) => card.style.removeProperty(v))
  card.style.background = ''
  const o = BLOCK_BGS[c.bg || 0]
  if (o && o.css) {
    setVars(card, cardVars(o.dark ? 'glass' : 'solid'))
    card.style.background = o.css
    if (o.dark) card.style.setProperty('--card-line', 'rgba(255,255,255,.18)')
  }
  const pair = c.custom || (c.series != null ? SERIES[c.series] : null)
  if (pair) setVars(card, { '--c1': pair[0], '--g1': pair[1] })
}

/* ---------- universal renderer ---------- */
export function draw(
  host: HTMLElement,
  type: string,
  c: BlockConfig,
  opt: { thumb?: boolean; W?: number; compact?: boolean; fillH?: number } = {},
) {
  host.innerHTML = ''
  const thumb = !!opt.thumb,
    compact = !!opt.compact,
    // Shrinks chart heights (keeping all labels/axes) so dense dashboards fit
    // without scrolling — used by the fluid preview modal.
    ch = (h: number) => (compact ? Math.round(h * 0.6) : h),
    D = blockData(c)
  host.classList.toggle('thumb', thumb)
  if (!D) {
    host.innerHTML = `<div class="ph">${vizSvg(type)}<span>Add a metric to see this chart</span></div>`
    return
  }
  const p = D.p,
    fz = (c.fz || 100) / 100,
    W = opt.W || 560
  const max = (a: number[]) => Math.max(...a, 0.0001)
  const legend = (items: Array<[string, string]>) => {
    if (!c.legend || thumb) return
    const d = document.createElement('div')
    d.className = 'rc-legend'
    d.innerHTML = items
      .map(([n, col]) => `<span><i style="background:${col}"></i>${esc(n)}</span>`)
      .join('')
    host.appendChild(d)
  }
  const catCol = (i: number) => `var(--c${(i % 6) + 1})`

  switch (type) {
    case 'number': {
      const d = document.createElement('div')
      // `rc-num` lets CSS push the sparkline to the card's bottom (via margin-top
      // auto) so a KPI card stretched tall by a taller neighbour keeps the number
      // at the top and the sparkline flush to the bottom — no stretched wave.
      d.className = 'rc-num'
      d.innerHTML = `<div class="rc-big ${c.gradText ? 'gt' : ''}" style="font-size:${(thumb ? 26 : compact ? 32 : 44) * fz}px">${fmt(p.total, p.unit, c)}</div>
        <div class="rc-delta">${p.compare === 'None' ? '' : deltaPill(p.total, p.prev, LOWER_IS_BETTER.has(p.metric)) + ' vs ' + fmt(p.prev, p.unit, c)}</div>`
      host.appendChild(d)
      if (c.metrics[0].small !== false) {
        const H = thumb ? 40 : ch(70)
        const s = svgEl(host, W, H)
        if (thumb) (s as SVGElement).style.marginTop = '4px'
        const m = max(p.vals),
          pts = p.vals.map((v: number, i: number) => [
            (i * W) / (p.vals.length - 1),
            H - 4 - (v / m) * (H - 10),
          ])
        el(
          'path',
          {
            d: smoothPath(pts) + ` L${W} ${H} L0 ${H}Z`,
            fill: gradDef(s, 0, 1, 'var(--c1)', 'transparent'),
            opacity: 0.25,
          },
          s,
        )
        el(
          'path',
          {
            d: smoothPath(pts),
            fill: 'none',
            stroke: gradDef(s, 1, 0),
            'stroke-width': thumb ? 3 : 2.5,
            'stroke-linecap': 'round',
          },
          s,
        )
      }
      break
    }
    case 'line':
    case 'bar': {
      // fillH (set by a second pass) draws the chart at the card's exact height
      // so it fills without the distortion a CSS stretch would cause.
      const H = opt.fillH ?? (thumb ? 150 : compact ? 132 : 260),
        L = thumb ? 4 : 46,
        R = W - 8,
        Tp = 10,
        B = H - (thumb ? 6 : 26)
      const s = svgEl(host, W, H)
      const useCats = type === 'bar' && D.hasBreakdown
      const vals = useCats ? D.cats.map((x: any) => x[1]) : p.vals
      const series = type === 'line' ? D.ms : [p]
      const m =
        max(
          type === 'line'
            ? series.flatMap((x: any) =>
                x.vals.concat(
                  x.compare === 'Previous' && x === p
                    ? x.vals.map((v: number) => (v * x.prev) / x.total)
                    : [],
                ),
              )
            : vals,
        ) * 1.1
      const y = (v: number) => B - (v / m) * (B - Tp)
      if (c.grid && !thumb)
        [0, 0.25, 0.5, 0.75, 1].forEach((t) => {
          el(
            'line',
            {
              x1: L,
              x2: R,
              y1: y(m * t),
              y2: y(m * t),
              stroke: 'var(--track)',
              'stroke-dasharray': t ? '3 4' : '',
            },
            s,
          )
          T(s, L - 8, y(m * t) + 4, fmt(m * t, p.unit, c, true), {
            'text-anchor': 'end',
            'font-size': 11,
          })
        })
      if (type === 'bar') {
        const step = (R - L) / vals.length,
          bw = step * (useCats ? 0.55 : 0.62),
          fill = gradDef(s, 0, 1, 'var(--g1)', 'var(--c1)')
        vals.forEach((v: number, i: number) => {
          const x = L + i * step + (step - bw) / 2
          const tr = trendTip(v, vals[i - 1])
          el(
            'rect',
            {
              x,
              y: y(v),
              width: bw,
              height: Math.max(1, B - y(v)),
              rx: c.rounded ? Math.min(6, bw / 2) : 1,
              fill,
              'data-tip': `${useCats ? D.cats[i][0] : 'Day ' + (i + 1)}: ${fmt(v, p.unit, c)}`,
              ...(tr.sub ? { 'data-tip-sub': tr.sub, 'data-tip-dir': tr.dir } : {}),
            },
            s,
          )
          if (c.labels && !thumb && (useCats || vals.length <= 14))
            T(s, x + bw / 2, y(v) - 6, fmt(v, p.unit, c, true), {
              'text-anchor': 'middle',
              'font-size': 11,
              fill: 'var(--card-ink)',
              'font-weight': 600,
            })
          if (!thumb && useCats)
            T(s, x + bw / 2, B + 17, D.cats[i][0].split(' ')[0], {
              'text-anchor': 'middle',
              'font-size': 11,
            })
          if (!thumb && !useCats && i % Math.ceil(vals.length / 8) === 0)
            T(s, x + bw / 2, B + 17, 'D' + (i + 1), {
              'text-anchor': 'middle',
              'font-size': 11,
            })
        })
      } else {
        series.forEach((sr: any, si: number) => {
          const col = si === 0 ? null : sr.color
          const pts = sr.vals.map((v: number, i: number) => [
            L + (i * (R - L)) / (sr.vals.length - 1),
            y(v),
          ])
          const path = c.smooth
            ? smoothPath(pts)
            : 'M' + pts.map((q: number[]) => q.join(' ')).join(' L')
          if (si === 0)
            el(
              'path',
              {
                d: path + ` L${R} ${B} L${L} ${B}Z`,
                fill: gradDef(s, 0, 1, 'var(--c1)', 'transparent'),
                opacity: 0.22,
              },
              s,
            )
          el(
            'path',
            {
              d: path,
              fill: 'none',
              stroke: col || gradDef(s, 1, 0),
              'stroke-width': thumb ? 4 : 2.5,
              'stroke-linejoin': 'round',
              'stroke-linecap': 'round',
            },
            s,
          )
          if (si === 0 && sr.compare === 'Previous' && !thumb) {
            const k = sr.prev / sr.total,
              pp = sr.vals.map((_v: number, i: number) => [
                pts[i][0],
                y(sr.vals[(i + 5) % sr.vals.length] * k),
              ])
            el(
              'path',
              {
                d: c.smooth
                  ? smoothPath(pp)
                  : 'M' + pp.map((q: number[]) => q.join(' ')).join(' L'),
                fill: 'none',
                stroke: 'var(--card-muted)',
                'stroke-width': 1.5,
                'stroke-dasharray': '4 4',
                opacity: 0.7,
              },
              s,
            )
          }
          if (c.labels && !thumb && si === 0) {
            const mi = sr.vals.indexOf(Math.max(...sr.vals))
            el(
              'circle',
              {
                cx: pts[mi][0],
                cy: pts[mi][1],
                r: 4.5,
                fill: 'var(--card-bg)',
                stroke: 'var(--c1)',
                'stroke-width': 2.5,
              },
              s,
            )
            T(s, pts[mi][0], pts[mi][1] - 10, 'Peak ' + fmt(sr.vals[mi], p.unit, c), {
              'text-anchor': 'middle',
              'font-size': 11.5,
              fill: 'var(--card-ink)',
              'font-weight': 600,
            })
          }
        })
        if (!thumb)
          // Invisible hover targets per point for tooltips.
          p.vals.forEach((v: number, i: number) => {
            const cx = L + (i * (R - L)) / (p.vals.length - 1)
            const txt =
              `D${i + 1} · ` +
              D.ms.map((sr: any) => `${sr.name}: ${fmt(sr.vals[i], sr.unit, c)}`).join(' · ')
            const tr = trendTip(v, p.vals[i - 1])
            el(
              'circle',
              {
                cx,
                cy: y(v),
                r: 9,
                fill: 'transparent',
                'pointer-events': 'all',
                'data-tip': txt,
                ...(tr.sub ? { 'data-tip-sub': tr.sub, 'data-tip-dir': tr.dir } : {}),
              },
              s,
            )
          })
        if (!thumb)
          for (let i = 0; i < p.vals.length; i += Math.ceil(p.vals.length / 8))
            T(s, L + (i * (R - L)) / (p.vals.length - 1), B + 17, 'D' + (i + 1), {
              'text-anchor': 'middle',
              'font-size': 11,
            })
        legend(
          D.ms
            .map((x: any, i: number) => [x.name, i ? x.color : 'var(--c1)'])
            .concat(
              p.compare === 'Previous' ? [['Previous period', 'var(--card-muted)']] : [],
            ),
        )
      }
      break
    }
    case 'hbar': {
      const rows = D.cats,
        bh = thumb ? 14 : 20,
        L = thumb ? 4 : 150,
        R = W - (thumb ? 4 : 64),
        m = max(rows.map((r: any) => r[1]))
      let rh = thumb ? 22 : compact ? 26 : 34,
        H = rows.length * rh + 6
      // When a second pass passes the card's real height, spread the rows to
      // fill it (centring each bar in its row) so a few bars don't leave a gap.
      const expand = !thumb && !!opt.fillH && opt.fillH > H
      if (expand) {
        H = opt.fillH as number
        rh = (H - 8) / rows.length
      }
      const s = svgEl(host, W, H),
        fill = gradDef(s, 1, 0)
      rows.forEach(([n, v]: [string, number], i: number) => {
        const yy = 4 + i * rh + (expand ? (rh - bh) / 2 : 0)
        if (!thumb)
          T(s, 0, yy + bh / 2 + 4, n.length > 20 ? n.slice(0, 19) + '…' : n, {
            'font-size': 12.5,
            fill: 'var(--card-ink-2)',
          })
        el(
          'rect',
          {
            x: L,
            y: yy,
            width: R - L,
            height: bh,
            rx: c.rounded ? bh / 2 : 3,
            fill: 'var(--track)',
          },
          s,
        )
        el(
          'rect',
          {
            x: L,
            y: yy,
            width: Math.max(6, ((R - L) * v) / m),
            height: bh,
            rx: c.rounded ? bh / 2 : 3,
            fill,
            'data-tip': `${n}: ${fmt(v, p.unit, c)}`,
          },
          s,
        )
        // A full-width transparent hit area so hovering the row (not just the
        // filled bar) shows the tooltip.
        el(
          'rect',
          {
            x: 0,
            y: yy - 2,
            width: W,
            height: bh + 4,
            fill: 'transparent',
            'pointer-events': 'all',
            'data-tip': `${n}: ${fmt(v, p.unit, c)}`,
          },
          s,
        )
        if (!thumb && c.labels !== false)
          T(s, R + 8, yy + bh / 2 + 4, fmt(v, p.unit, c), {
            'font-size': 12.5,
            fill: 'var(--card-ink)',
            'font-weight': 600,
          })
      })
      break
    }
    case 'pie': {
      const rows = D.cats.slice(0, 6),
        tot = rows.reduce((a: number, r: any) => a + r[1], 0)
      const Wp = thumb ? 150 : W
      let H = thumb ? 150 : ch(230)
      // When a second pass passes the card's real height, grow to fill a tall
      // card (keeping room for the legend) so the donut isn't left small.
      if (opt.fillH && !thumb) {
        const he = host as HTMLElement
        const w2 = he.clientWidth || Wp
        const reserve = c.legend ? 48 : 12 // px left for the legend row below
        const target = ((he.clientHeight - reserve) * Wp) / w2
        if (target > H) H = target
      }
      // Donut sized by the smaller dimension so it never overflows the width,
      // then centred in the (possibly taller) plot area.
      const dim = Math.min(H, Wp),
        s = svgEl(host, Wp, H),
        cx = Wp / 2,
        cy = H / 2,
        r = dim / 2 - 8,
        // Ring thickness scales with the donut so the centre hole (and its text)
        // stays proportional at any size (e.g. the compact preview).
        w = thumb ? 22 : Math.round(dim * 0.13)
      let a0 = -Math.PI / 2
      rows.forEach(([n, v]: [string, number], i: number) => {
        const a1 = a0 + (v / tot) * Math.PI * 2,
          large = a1 - a0 > Math.PI ? 1 : 0
        const P = (a: number, rr: number) => [
          cx + rr * Math.cos(a),
          cy + rr * Math.sin(a),
        ]
        const [x0, y0] = P(a0, r),
          [x1, y1] = P(a1 - 0.015, r),
          [x2, y2] = P(a1 - 0.015, r - w),
          [x3, y3] = P(a0, r - w)
        el(
          'path',
          {
            d: `M${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r - w} ${r - w} 0 ${large} 0 ${x3} ${y3}Z`,
            fill: catCol(i),
            'data-tip': `${n}: ${fmt(v, p.unit, c)} · ${((v / tot) * 100).toFixed(0)}%`,
          },
          s,
        )
        a0 = a1
      })
      if (!thumb) {
        // Centre value + label sized relative to the donut so they fit the hole.
        const vf = Math.round(dim * 0.096) * fz
        T(s, cx, cy + vf * 0.1, fmt(tot, p.unit, c, p.unit !== '$'), {
          'text-anchor': 'middle',
          'font-size': vf,
          'font-weight': 650,
          fill: 'var(--card-ink)',
        })
        T(s, cx, cy + vf * 0.95, 'Total', {
          'text-anchor': 'middle',
          'font-size': Math.round(dim * 0.05),
        })
      }
      legend(rows.map(([n]: [string, number], i: number) => [n, catCol(i)]))
      break
    }
    case 'table': {
      const rows = D.cats,
        tot = rows.reduce((a: number, r: any) => a + r[1], 0),
        m = max(rows.map((r: any) => r[1]))
      const extra = D.ms.slice(1).filter((x: any) => x.cats)
      const t = document.createElement('table')
      t.className = 'rc-table'
      t.innerHTML = `<thead><tr><th>${D.hasBreakdown ? c.metrics[0].breakdown[0] + c.metrics[0].breakdown.slice(1).toLowerCase() : 'Period'}</th>${extra.map((x: any) => `<th>${esc(x.name)}</th>`).join('')}<th>${esc(p.name)}</th>${thumb ? '' : '<th>Share</th>'}</tr></thead>
        <tbody>${rows
          .slice(0, thumb ? 4 : compact ? 5 : 8)
          .map(
            ([n, v]: [string, number]) =>
              `<tr><td>${esc(n)}${thumb ? '' : `<span class="rc-share"><i style="width:${(v / m) * 100}%"></i></span>`}</td>${extra
                .map((x: any) => {
                  const f = x.cats.find((q: any) => q[0] === n)
                  return `<td>${f ? fmt(f[1], x.unit, c) : '—'}</td>`
                })
                .join(
                  '',
                )}<td><b>${fmt(v, p.unit, c)}</b></td>${thumb ? '' : `<td style="color:var(--card-muted)">${((v / tot) * 100).toFixed(0)}%</td>`}</tr>`,
          )
          .join('')}</tbody>`
      host.appendChild(t)
      break
    }
    case 'gauge':
    case 'progress':
    case 'radial': {
      const target = p.target,
        ratio = Math.min(1, p.total / target)
      if (type === 'gauge') {
        const H = thumb ? 110 : compact ? 150 : 190,
          Wg = thumb ? 180 : 320,
          s = svgEl(host, Wg, H),
          cx = Wg / 2,
          cy = H - (thumb ? 10 : 34),
          r = Math.min(Wg / 2 - 16, cy - 10),
          w = thumb ? 16 : 20
        const arc = (a0: number, a1: number, col: string, tip?: string) => {
          const [x0, y0] = [cx + r * Math.cos(a0), cy - r * Math.sin(a0)],
            [x1, y1] = [cx + r * Math.cos(a1), cy - r * Math.sin(a1)]
          el(
            'path',
            {
              d: `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`,
              fill: 'none',
              stroke: col,
              'stroke-width': w,
              'stroke-linecap': 'round',
              ...(tip ? { 'data-tip': tip } : {}),
            },
            s,
          )
        }
        arc(Math.PI, 0, 'var(--track)')
        arc(
          Math.PI,
          Math.PI - ratio * Math.PI,
          gradDef(s, 1, 0),
          `${fmt(p.total, p.unit, c)} · ${(ratio * 100).toFixed(0)}% of ${fmt(target, p.unit, c)} target`,
        )
        T(s, cx, cy - (thumb ? 6 : 14), fmt(p.total, p.unit, c), {
          'text-anchor': 'middle',
          'font-size': (thumb ? 22 : 34) * fz,
          'font-weight': 650,
          fill: 'var(--card-ink)',
        })
        if (!thumb) {
          T(
            s,
            cx,
            cy + 8,
            `${(ratio * 100).toFixed(0)}% of ${fmt(target, p.unit, c)} target`,
            { 'text-anchor': 'middle' },
          )
          T(s, cx - r, cy + 28, fmt(0, p.unit, c, true), {
            'text-anchor': 'middle',
            'font-size': 11,
          })
          T(s, cx + r, cy + 28, fmt(target, p.unit, c, true), {
            'text-anchor': 'middle',
            'font-size': 11,
          })
        }
        host.style.maxWidth = thumb ? '' : '420px'
        host.style.margin = '8px auto 0'
      } else if (type === 'progress') {
        const d = document.createElement('div')
        d.innerHTML = `<div style="display:flex;align-items:baseline;justify-content:space-between"><div class="rc-big" style="font-size:${(thumb ? 22 : 38) * fz}px">${fmt(p.total, p.unit, c)}</div>${thumb ? '' : `<span style="color:var(--card-muted);font-size:13px">Target ${fmt(target, p.unit, c)}</span>`}</div>
          <div style="height:${thumb ? 12 : 16}px;border-radius:99px;background:var(--track);margin-top:${thumb ? 10 : 16}px;overflow:hidden"><div style="height:100%;width:${ratio * 100}%;border-radius:99px;background:linear-gradient(90deg,var(--c1),var(--g1))"></div></div>
          ${thumb ? '' : `<div class="rc-delta" style="justify-content:space-between"><span>${(ratio * 100).toFixed(0)}% of target</span><span>${fmt(Math.max(0, target - p.total), p.unit, c)} to go</span></div>`}`
        host.appendChild(d)
      } else {
        const rows = D.cats.slice(0, 4),
          m = max(rows.map((r: any) => r[1])),
          H = thumb ? 120 : 220,
          s = svgEl(host, thumb ? 120 : 220, H),
          cx = (thumb ? 120 : 220) / 2,
          cy = H / 2
        rows.forEach(([n, v]: [string, number], i: number) => {
          const r = H / 2 - 8 - i * (thumb ? 13 : 24),
            sw = thumb ? 9 : 16,
            frac = (v / m) * 0.78,
            a = frac * Math.PI * 2
          el(
            'circle',
            { cx, cy, r, fill: 'none', stroke: 'var(--track)', 'stroke-width': sw },
            s,
          )
          const x1 = cx + r * Math.sin(a),
            y1 = cy - r * Math.cos(a)
          el(
            'title',
            {},
            el(
              'path',
              {
                d: `M${cx} ${cy - r} A${r} ${r} 0 ${a > Math.PI ? 1 : 0} 1 ${x1} ${y1}`,
                fill: 'none',
                stroke: catCol(i),
                'stroke-width': sw,
                'stroke-linecap': 'round',
              },
              s,
            ),
            `${n}: ${fmt(v, p.unit, c)}`,
          )
        })
        host.style.maxWidth = thumb ? '' : '260px'
        host.style.margin = '0 auto'
        legend(
          rows.map(([n, v]: [string, number], i: number) => [
            `${n} · ${fmt(v, p.unit, c, true)}`,
            catCol(i),
          ]),
        )
      }
      break
    }
    case 'funnel':
    case 'pipeline': {
      const rows =
          type === 'funnel' ? [...D.cats].sort((a: any, b: any) => b[1] - a[1]) : D.cats,
        m = max(rows.map((r: any) => r[1]))
      const rh = thumb ? 20 : 40,
        H = rows.length * (rh + 6),
        s = svgEl(host, W, H)
      rows.forEach(([n, v]: [string, number], i: number) => {
        const yy = i * (rh + 6)
        if (type === 'funnel') {
          const w1 = (W - 20) * Math.max(0.18, v / m),
            nx = rows[i + 1] ? (W - 20) * Math.max(0.18, rows[i + 1][1] / m) : w1 * 0.85,
            x = (W - w1) / 2
          el(
            'path',
            {
              d: `M${x} ${yy} L${x + w1} ${yy} L${(W + nx) / 2} ${yy + rh} L${(W - nx) / 2} ${yy + rh}Z`,
              fill: catCol(i),
              opacity: 0.92,
            },
            s,
          )
          if (!thumb)
            T(s, W / 2, yy + rh / 2 + 5, `${n} · ${fmt(v, p.unit, c)}`, {
              'text-anchor': 'middle',
              fill: '#fff',
              'font-weight': 600,
              'font-size': 13,
            })
        } else {
          const bw = (W - 10) * Math.max(0.12, v / m)
          el(
            'path',
            {
              d: `M0 ${yy} L${bw - 14} ${yy} L${bw} ${yy + rh / 2} L${bw - 14} ${yy + rh} L0 ${yy + rh}Z`,
              fill: i % 2 ? 'var(--g1)' : 'var(--c1)',
              opacity: 0.9,
            },
            s,
          )
          if (!thumb) {
            T(s, 12, yy + rh / 2 + 5, n, {
              fill: '#fff',
              'font-weight': 600,
              'font-size': 13,
            })
            T(s, Math.max(bw + 10, 220), yy + rh / 2 + 5, fmt(v, p.unit, c), {
              'font-weight': 600,
              fill: 'var(--card-ink)',
              'font-size': 13,
            })
          }
        }
      })
      break
    }
    case 'heatmap': {
      const vals = p.vals.slice(-35),
        weeks = Math.ceil(vals.length / 7),
        cs = thumb ? 16 : 30,
        gap = thumb ? 3 : 5,
        L = thumb ? 0 : 34,
        m = max(vals)
      const s = svgEl(host, L + 7 * (cs + gap), weeks * (cs + gap) + (thumb ? 0 : 22))
      ;['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(
        (d, i) =>
          !thumb &&
          T(s, L + i * (cs + gap) + cs / 2, 12, d, {
            'text-anchor': 'middle',
            'font-size': 11,
          }),
      )
      vals.forEach((v: number, i: number) => {
        const r = el(
          'rect',
          {
            x: L + (i % 7) * (cs + gap),
            y: (thumb ? 0 : 20) + Math.floor(i / 7) * (cs + gap),
            width: cs,
            height: cs,
            rx: thumb ? 3 : 6,
            fill: 'var(--c1)',
            'fill-opacity': 0.12 + (0.88 * v) / m,
          },
          s,
        )
        el('title', {}, r, `Day ${i + 1}: ${fmt(v, p.unit, c)}`)
      })
      if (!thumb)
        for (let w = 0; w < weeks; w++)
          T(s, 0, 20 + w * (cs + gap) + cs / 2 + 4, 'W' + (w + 1), { 'font-size': 11 })
      host.style.maxWidth = thumb ? '' : '380px'
      host.style.margin = '0 auto'
      break
    }
    case 'bubble': {
      const rows = D.cats.slice(0, 6),
        m = max(rows.map((r: any) => r[1])),
        Wb = thumb ? 200 : W
      let H = thumb ? 140 : compact ? 162 : 240
      // When a second pass passes the card's real height, grow the plot to fill a
      // tall card (keeping room for the legend) so the bubbles spread out instead
      // of clustering with empty space below.
      if (opt.fillH && !thumb) {
        const he = host as HTMLElement
        const w = he.clientWidth || Wb
        const reserve = c.legend ? 52 : 12 // px left for the legend rows under the plot
        const target = ((he.clientHeight - reserve) * Wb) / w
        if (target > H) H = target
      }
      const s = svgEl(host, Wb, H)
      const placed: any[] = [],
        cx = Wb / 2,
        cy = H / 2
      rows
        .map((r: any, i: number) => ({
          n: r[0],
          v: r[1],
          i,
          rad: Math.max(thumb ? 7 : 10, Math.sqrt(r[1] / m) * Math.min(H, Wb) * 0.21),
        }))
        .sort((a: any, b: any) => b.rad - a.rad)
        .forEach((b: any) => {
          let best: any = null
          for (let t = 0; t < 4000 && !best; t++) {
            const ang = t * 0.35,
              dist = t * 0.25,
              x = cx + dist * Math.cos(ang),
              y = cy + dist * Math.sin(ang) * 0.7
            if (x - b.rad < 2 || x + b.rad > Wb - 2 || y - b.rad < 2 || y + b.rad > H - 2)
              continue
            if (placed.every((q) => Math.hypot(q.x - x, q.y - y) >= q.rad + b.rad + 4))
              best = { x, y }
          }
          if (!best) {
            b.rad *= 0.7
            best = {
              x: Math.min(
                Wb - b.rad,
                Math.max(b.rad, cx + (placed.length % 2 ? 1 : -1) * (Wb / 2 - b.rad - 4)),
              ),
              y: cy,
            }
          }
          Object.assign(b, best)
          placed.push(b)
          const g = el('g', {}, s)
          el(
            'circle',
            {
              cx: b.x,
              cy: b.y,
              r: b.rad,
              fill: catCol(b.i),
              'fill-opacity': 0.22,
              stroke: catCol(b.i),
              'stroke-width': 2,
            },
            g,
          )
          if (!thumb && b.rad > 24) {
            T(g, b.x, b.y + 1, fmt(b.v, p.unit, c, true), {
              'text-anchor': 'middle',
              'font-weight': 650,
              fill: 'var(--card-ink)',
              'font-size': 13 * fz,
            })
            // Keep the in-bubble label inside the circle: use the last path
            // segment (or first word) and truncate to what the width allows, so
            // long names (e.g. "/products/fitness-tracker") don't spill over and
            // overlap neighbouring bubbles. The full name stays in the legend.
            const fs = 10.5
            let lbl = b.n.includes('/')
              ? b.n.split('/').filter(Boolean).pop() || b.n
              : b.n.split(' ')[0]
            const maxCh = Math.floor((b.rad * 2 - 8) / (fs * 0.6))
            if (maxCh >= 3) {
              if (lbl.length > maxCh) lbl = lbl.slice(0, maxCh - 1) + '…'
              T(g, b.x, b.y + 16, lbl, {
                'text-anchor': 'middle',
                'font-size': fs,
              })
            }
          }
          el('title', {}, g, `${b.n}: ${fmt(b.v, p.unit, c)}`)
        })
      legend(rows.map(([n]: [string, number], i: number) => [n, catCol(i)]))
      break
    }
    case 'spider': {
      const rows = D.cats.length >= 3 ? D.cats.slice(0, 6) : D.cats,
        n = rows.length,
        m = max(rows.map((r: any) => r[1])),
        H = thumb ? 130 : 260,
        Ws = thumb ? 160 : W
      const s = svgEl(host, Ws, H),
        cx = Ws / 2,
        cy = H / 2 + (thumb ? 0 : 6),
        R = H / 2 - (thumb ? 8 : 34)
      const P = (i: number, k: number) => [
        cx + R * k * Math.sin((i / n) * Math.PI * 2),
        cy - R * k * Math.cos((i / n) * Math.PI * 2),
      ]
      ;[0.25, 0.5, 0.75, 1].forEach((k) =>
        el(
          'polygon',
          {
            points: rows.map((_: any, i: number) => P(i, k).join(',')).join(' '),
            fill: 'none',
            stroke: 'var(--track)',
            'stroke-width': 1,
          },
          s,
        ),
      )
      rows.forEach((r: any, i: number) => {
        el(
          'line',
          { x1: cx, y1: cy, x2: P(i, 1)[0], y2: P(i, 1)[1], stroke: 'var(--track)' },
          s,
        )
        if (!thumb) {
          const [x, y] = P(i, 1.16)
          T(s, x, y + 4, r[0].split(' ')[0], {
            'text-anchor': 'middle',
            'font-size': 11.5,
            fill: 'var(--card-ink-2)',
          })
        }
      })
      const pts = rows
        .map((r: any, i: number) => P(i, Math.max(0.08, r[1] / m)).join(','))
        .join(' ')
      el(
        'polygon',
        {
          points: pts,
          fill: gradDef(s, 1, 1),
          'fill-opacity': 0.35,
          stroke: 'var(--c1)',
          'stroke-width': 2.5,
          'stroke-linejoin': 'round',
        },
        s,
      )
      break
    }
  }
}
