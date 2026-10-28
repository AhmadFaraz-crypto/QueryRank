// Google data-source API clients used by the QueryRank server. Each function
// performs a real API call; the server supplies a valid OAuth access token
// (token storage/refresh lives in the server).

export {
  gscListSites,
  gscQuery,
  GSC_SCOPE,
  type GscSite,
  type GscRow,
  type GscQueryBody,
} from './gsc'
export {
  ga4ListProperties,
  ga4RunReport,
  GA4_SCOPE,
  type Ga4Property,
  type Ga4ReportRow,
  type Ga4ReportBody,
} from './ga4'
