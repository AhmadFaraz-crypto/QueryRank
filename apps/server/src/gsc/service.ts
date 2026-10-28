import { gscQuery, type GscRow } from '@queryrank/adapters'
import { lastN, prevRange } from '../dates'

const EMPTY_ROW: GscRow = { clicks: 0, impressions: 0, ctr: 0, position: 0 }

export interface GscOverview {
  range: { startDate: string; endDate: string }
  totals: GscRow
  prevTotals: GscRow
  topQueries: GscRow[]
  byPage: GscRow[]
  byDevice: GscRow[]
  series: GscRow[]
}

/**
 * Everything the dashboards need for a property over the last `days` days:
 * current and previous-period totals, top queries, breakdowns by page and
 * device, and the daily series.
 */
export async function gscOverview(
  accessToken: string,
  siteUrl: string,
  days = 28,
): Promise<GscOverview> {
  const range = lastN(days)
  const prev = prevRange(range)
  const [totalsRows, prevRows, topQueries, byPage, byDevice, series] = await Promise.all([
    gscQuery(accessToken, siteUrl, range),
    gscQuery(accessToken, siteUrl, prev),
    gscQuery(accessToken, siteUrl, { ...range, dimensions: ['query'], rowLimit: 10 }),
    gscQuery(accessToken, siteUrl, { ...range, dimensions: ['page'], rowLimit: 10 }),
    gscQuery(accessToken, siteUrl, { ...range, dimensions: ['device'] }),
    gscQuery(accessToken, siteUrl, { ...range, dimensions: ['date'], rowLimit: 500 }),
  ])
  return {
    range,
    totals: totalsRows[0] ?? EMPTY_ROW,
    prevTotals: prevRows[0] ?? EMPTY_ROW,
    topQueries,
    byPage,
    byDevice,
    series,
  }
}
