const SITES_ENDPOINT = 'https://www.googleapis.com/webmasters/v3/sites'
const SA_ENDPOINT = (siteUrl: string) =>
  `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`

/** OAuth scope required to read Search Console data. */
export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'

export interface GscSite {
  siteUrl: string
  permissionLevel: string
}

export interface GscQueryBody {
  startDate: string
  endDate: string
  dimensions?: string[]
  rowLimit?: number
}

export interface GscRow {
  keys?: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

async function gscFetch<T>(
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
  if (!res.ok) {
    throw new Error(`Search Console API ${res.status}: ${await res.text()}`)
  }
  return (await res.json()) as T
}

/** Properties the authorized account can access in Search Console. */
export async function gscListSites(accessToken: string): Promise<GscSite[]> {
  const data = await gscFetch<{ siteEntry?: GscSite[] }>(accessToken, SITES_ENDPOINT)
  return data.siteEntry ?? []
}

/** Run a Search Analytics query for a property. */
export async function gscQuery(
  accessToken: string,
  siteUrl: string,
  body: GscQueryBody,
): Promise<GscRow[]> {
  const data = await gscFetch<{ rows?: GscRow[] }>(accessToken, SA_ENDPOINT(siteUrl), {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return data.rows ?? []
}
