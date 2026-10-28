import { ga4RunReport, type Ga4ReportRow } from '@queryrank/adapters'
import { lastN, prevRange } from '../dates'

// Core GA4 metrics we surface, in a fixed order so the report rows line up.
const METRIC_NAMES = ['sessions', 'totalUsers', 'screenPageViews', 'engagementRate']

export interface Ga4Totals {
  sessions: number
  users: number
  pageViews: number
  engagementRate: number
}

export interface Ga4Overview {
  range: { startDate: string; endDate: string }
  totals: Ga4Totals
  prevTotals: Ga4Totals
  series: Array<{
    date: string
    sessions: number
    users: number
    views: number
    engagementRate: number
  }>
  byChannel: Array<{ channel: string; sessions: number }>
}

function totalsFrom(rows: Ga4ReportRow[]): Ga4Totals {
  const m = rows[0]?.metrics ?? [0, 0, 0, 0]
  return { sessions: m[0], users: m[1], pageViews: m[2], engagementRate: m[3] }
}

/**
 * Current and previous-period totals, a daily sessions series, and sessions by
 * default channel group, for a GA4 property over the last `days` days.
 */
export async function ga4Overview(
  accessToken: string,
  property: string,
  days = 28,
): Promise<Ga4Overview> {
  const range = lastN(days)
  const prev = prevRange(range)
  const [cur, prv, series, byChannel] = await Promise.all([
    ga4RunReport(accessToken, property, { ...range, metrics: METRIC_NAMES }),
    ga4RunReport(accessToken, property, { ...prev, metrics: METRIC_NAMES }),
    ga4RunReport(accessToken, property, {
      ...range,
      metrics: METRIC_NAMES,
      dimensions: ['date'],
      limit: 500,
    }),
    ga4RunReport(accessToken, property, {
      ...range,
      metrics: ['sessions'],
      dimensions: ['sessionDefaultChannelGroup'],
      limit: 10,
    }),
  ])
  return {
    range,
    totals: totalsFrom(cur),
    prevTotals: totalsFrom(prv),
    series: series
      .map((r) => ({
        date: r.dimensions[0],
        sessions: r.metrics[0],
        users: r.metrics[1],
        views: r.metrics[2],
        engagementRate: r.metrics[3],
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    byChannel: byChannel.map((r) => ({
      channel: r.dimensions[0],
      sessions: r.metrics[0],
    })),
  }
}
