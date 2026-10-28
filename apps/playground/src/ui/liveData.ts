import { setLiveCatsForRange, setLiveSeriesForRange } from './viz/engine'

// Fetches live data for connected sources and injects it into the chart engine,
// keyed by the date window (days) it was fetched for. `resolveLiveSources`
// discovers the connected sources + their site/property options; `fetchLiveRange`
// pulls one source's data for one window. Each metric name a source produces is
// mapped to the engine's registry, which renders live values wherever that
// metric appears (synthetic demo data remains the fallback for everything else).

interface Row {
  keys?: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}
interface GscOverview {
  range: { startDate: string; endDate: string }
  totals: Row
  prevTotals: Row
  topQueries: Row[]
  byPage: Row[]
  byDevice: Row[]
  series: Row[]
}
interface Conn {
  id: string
  provider: string
  label: string
}

const api = (path: string) => fetch(path, { credentials: 'include' })

// --- which site / property each source should pull -------------------------
// Persisted so a chosen Search Console site or GA4 property survives reloads.
const SITE_KEY = 'qr.live.gscSite'
const PROP_KEY = 'qr.live.ga4Property'
const pref = (k: string): string => {
  try {
    return localStorage.getItem(k) || ''
  } catch {
    return ''
  }
}
export function setLiveSourcePref(source: 'gsc' | 'ga4', value: string): void {
  try {
    localStorage.setItem(source === 'gsc' ? SITE_KEY : PROP_KEY, value)
  } catch {
    /* storage unavailable — honored for this session only */
  }
}

/** One connected source and the options the user can pick from for it. */
export interface LiveSource {
  connId: string
  options: { value: string; label: string }[]
  selected: string
  /** True when fetching data for `selected` failed — show "data not loaded",
   *  never dummy, for this source's cards. */
  error?: boolean
}
/** What `loadLiveData` discovered: whether anything went live + the pickers. */
export interface LiveState {
  injected: boolean
  gsc?: LiveSource
  ga4?: LiveSource
}

function pageLabel(url?: string): string {
  if (!url) return ''
  try {
    return new URL(url).pathname || '/'
  } catch {
    return url
  }
}
const deviceLabel = (d?: string) => (d ? d.charAt(0) + d.slice(1).toLowerCase() : '')
const pair = (k: string, v: number): [string, number] => [k, v]

/** Map a Search Console overview onto the engine's GSC metric names, for `days`. */
function applyGsc(days: number, o: GscOverview): void {
  const num = (key: 'clicks' | 'impressions') => ({
    vals: o.series.map((r) => r[key]),
    total: o.totals[key],
    prev: o.prevTotals[key],
    unit: '',
    avg: false,
    target: o.totals[key] * 1.1,
  })
  setLiveSeriesForRange(days, 'Clicks', num('clicks'))
  setLiveSeriesForRange(days, 'Impressions', num('impressions'))
  setLiveSeriesForRange(days, 'CTR', {
    vals: o.series.map((r) => r.ctr * 100),
    total: o.totals.ctr * 100,
    prev: o.prevTotals.ctr * 100,
    unit: '%',
    avg: true,
    target: o.totals.ctr * 100 * 1.1,
  })
  setLiveSeriesForRange(days, 'Average Position', {
    vals: o.series.map((r) => r.position),
    total: o.totals.position,
    prev: o.prevTotals.position,
    unit: '',
    avg: true,
    target: o.totals.position,
  })
  setLiveCatsForRange(
    days,
    'Clicks',
    'QUERY',
    o.topQueries.map((r) => pair(r.keys?.[0] ?? '', r.clicks)),
  )
  setLiveCatsForRange(
    days,
    'Impressions',
    'QUERY',
    o.topQueries.map((r) => pair(r.keys?.[0] ?? '', r.impressions)),
  )
  setLiveCatsForRange(
    days,
    'Clicks',
    'PAGE',
    o.byPage.map((r) => pair(pageLabel(r.keys?.[0]), r.clicks)),
  )
  setLiveCatsForRange(
    days,
    'Impressions',
    'PAGE',
    o.byPage.map((r) => pair(pageLabel(r.keys?.[0]), r.impressions)),
  )
  setLiveCatsForRange(
    days,
    'Clicks',
    'DEVICE',
    o.byDevice.map((r) => pair(deviceLabel(r.keys?.[0]), r.clicks)),
  )
  setLiveCatsForRange(
    days,
    'Impressions',
    'DEVICE',
    o.byDevice.map((r) => pair(deviceLabel(r.keys?.[0]), r.impressions)),
  )
}

interface Ga4Overview {
  range: { startDate: string; endDate: string }
  totals: { sessions: number; users: number; pageViews: number; engagementRate: number }
  prevTotals: {
    sessions: number
    users: number
    pageViews: number
    engagementRate: number
  }
  series: Array<{
    date: string
    sessions: number
    users: number
    views: number
    engagementRate: number
  }>
  byChannel: Array<{ channel: string; sessions: number }>
}

/** Map a GA4 overview onto the engine's GA4 metric names. */
function applyGa4(days: number, o: Ga4Overview): void {
  setLiveSeriesForRange(days, 'Sessions', {
    vals: o.series.map((r) => r.sessions),
    total: o.totals.sessions,
    prev: o.prevTotals.sessions,
    unit: '',
    avg: false,
    target: o.totals.sessions * 1.1,
  })
  setLiveSeriesForRange(days, 'Active Users', {
    vals: o.series.map((r) => r.users),
    total: o.totals.users,
    prev: o.prevTotals.users,
    unit: '',
    avg: false,
    target: o.totals.users * 1.1,
  })
  setLiveSeriesForRange(days, 'Views', {
    vals: o.series.map((r) => r.views),
    total: o.totals.pageViews,
    prev: o.prevTotals.pageViews,
    unit: '',
    avg: false,
    target: o.totals.pageViews * 1.1,
  })
  setLiveSeriesForRange(days, 'Engagement Rate', {
    vals: o.series.map((r) => r.engagementRate * 100),
    total: o.totals.engagementRate * 100,
    prev: o.prevTotals.engagementRate * 100,
    unit: '%',
    avg: true,
    target: 70,
  })
  setLiveCatsForRange(
    days,
    'Sessions',
    'CHANNEL',
    o.byChannel.map((r) => pair(r.channel, r.sessions)),
  )
}

// Pick the saved choice if it's still available, otherwise the first option.
const choose = (options: string[], saved: string): string =>
  options.includes(saved) ? saved : (options[0] ?? '')

/**
 * Discover the connected sources and their site/property options WITHOUT
 * fetching any data — the per-card date ranges drive the actual fetches via
 * `fetchLiveRange`. Returns the pickers, with `error` set on a source whose
 * site/property list couldn't be loaded (so its cards show "data not loaded").
 */
export async function resolveLiveSources(): Promise<LiveState> {
  const state: LiveState = { injected: false }
  try {
    const res = await api('/api/connections')
    if (!res.ok) return state
    const conns = (await res.json()) as Conn[]

    const gsc = conns.find((c) => c.provider === 'gsc')
    if (gsc) {
      try {
        const sitesRes = await api(`/api/connections/${gsc.id}/sites`)
        if (sitesRes.ok) {
          const urls = ((await sitesRes.json()) as { siteUrl: string }[]).map((s) => s.siteUrl)
          const site = choose(urls, pref(SITE_KEY))
          state.gsc = {
            connId: gsc.id,
            options: urls.map((u) => ({ value: u, label: u })),
            selected: site,
            error: !site,
          }
        } else {
          state.gsc = { connId: gsc.id, options: [], selected: '', error: true }
        }
      } catch {
        state.gsc = { connId: gsc.id, options: [], selected: '', error: true }
      }
    }

    const ga4 = conns.find((c) => c.provider === 'ga4')
    if (ga4) {
      try {
        const propsRes = await api(`/api/connections/${ga4.id}/properties`)
        if (propsRes.ok) {
          const props = (await propsRes.json()) as { property: string; displayName?: string }[]
          const ids = props.map((p) => p.property)
          const property = choose(ids, pref(PROP_KEY))
          state.ga4 = {
            connId: ga4.id,
            options: props.map((p) => ({ value: p.property, label: p.displayName || p.property })),
            selected: property,
            error: !property,
          }
        } else {
          state.ga4 = { connId: ga4.id, options: [], selected: '', error: true }
        }
      } catch {
        state.ga4 = { connId: ga4.id, options: [], selected: '', error: true }
      }
    }
  } catch {
    /* backend unreachable — no sources resolved */
  }
  return state
}

/**
 * Fetch one source's data for one window (`days`) and inject it into the engine
 * registry keyed by that window. Returns false if the fetch failed, so the
 * caller can show "data not loaded" for that window instead of dummy.
 */
export async function fetchLiveRange(
  kind: 'gsc' | 'ga4',
  connId: string,
  selected: string,
  days: number,
): Promise<boolean> {
  if (!selected) return false
  const param = kind === 'gsc' ? 'site' : 'property'
  const url = `/api/connections/${connId}/overview?${param}=${encodeURIComponent(selected)}&days=${days}`
  try {
    const ov = await api(url)
    if (!ov.ok) return false
    if (kind === 'gsc') applyGsc(days, (await ov.json()) as GscOverview)
    else applyGa4(days, (await ov.json()) as Ga4Overview)
    return true
  } catch {
    return false
  }
}
