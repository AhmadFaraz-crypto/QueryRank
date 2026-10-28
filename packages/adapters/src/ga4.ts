const ADMIN_ENDPOINT = 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries'
const DATA_ENDPOINT = (property: string) =>
  `https://analyticsdata.googleapis.com/v1beta/${property}:runReport`

/** OAuth scope required to read Google Analytics 4 data. */
export const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'

export interface Ga4Property {
  property: string // "properties/123456789"
  displayName: string
}

export interface Ga4ReportBody {
  startDate: string
  endDate: string
  metrics: string[]
  dimensions?: string[]
  limit?: number
}

export interface Ga4ReportRow {
  dimensions: string[]
  metrics: number[]
}

async function ga4Fetch<T>(
  accessToken: string,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`GA4 API ${res.status}: ${await res.text()}`)
  return (await res.json()) as T
}

/** GA4 properties the authorized account can access. */
export async function ga4ListProperties(accessToken: string): Promise<Ga4Property[]> {
  const data = await ga4Fetch<{
    accountSummaries?: Array<{
      propertySummaries?: Array<{ property: string; displayName: string }>
    }>
  }>(accessToken, ADMIN_ENDPOINT)
  return (data.accountSummaries ?? []).flatMap((a) =>
    (a.propertySummaries ?? []).map((p) => ({
      property: p.property,
      displayName: p.displayName,
    })),
  )
}

/** Run a GA4 Data API report for a property. */
export async function ga4RunReport(
  accessToken: string,
  property: string,
  body: Ga4ReportBody,
): Promise<Ga4ReportRow[]> {
  const data = await ga4Fetch<{
    rows?: Array<{
      dimensionValues?: { value: string }[]
      metricValues?: { value: string }[]
    }>
  }>(accessToken, DATA_ENDPOINT(property), {
    method: 'POST',
    body: JSON.stringify({
      dateRanges: [{ startDate: body.startDate, endDate: body.endDate }],
      metrics: body.metrics.map((name) => ({ name })),
      dimensions: (body.dimensions ?? []).map((name) => ({ name })),
      limit: body.limit,
    }),
  })
  return (data.rows ?? []).map((r) => ({
    dimensions: (r.dimensionValues ?? []).map((d) => d.value),
    metrics: (r.metricValues ?? []).map((m) => Number(m.value) || 0),
  }))
}
