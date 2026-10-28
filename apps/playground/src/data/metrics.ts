/**
 * Metric library for the dashboard designer.
 *
 * Each metric has a name, one or more data sources, and a kind. Values are
 * deterministic demo figures so the list renders the same on every load.
 */

export type MetricKind = 'custom' | 'calc' | 'basic'

export interface Metric {
  id: string
  name: string
  /** Raw source string as shown in the list, e.g. "Token, Sample dataset". */
  sourceLabel: string
  /** Primary (first) source, used for the badge. */
  primarySource: string
  sources: string[]
  kind: MetricKind
  /** Formatted demo value. */
  value: string
}

/** Badge color + short glyph standing in for each source's logo. */
export const SOURCE_BADGES: Record<string, { bg: string; glyph: string }> = {
  'Sample dataset': { bg: '#1f7a45', glyph: 'S' },
  'Google Search Console': { bg: '#4285f4', glyph: 'S' },
  'Google Analytics 4': { bg: '#e37400', glyph: 'G' },
}

/** Known headline values that match the sample dashboard. */
const KNOWN_VALUES: Record<string, string> = {
  'Average Order Value': '$ 29.47',
  Orders: '30',
  Profit: '$ 795.60',
  Quantity: '45',
  Revenue: '$ 884.00',
}

const RAW = `Revenue|Sample dataset|calc
Profit|Sample dataset|calc
Orders|Sample dataset|calc
Quantity|Sample dataset|calc
Average Order Value|Sample dataset|custom
Clicks|Google Search Console
Impressions|Google Search Console
CTR|Google Search Console
Average Position|Google Search Console
Sessions|Google Analytics 4
Active Users|Google Analytics 4
New Users|Google Analytics 4
Returning Users|Google Analytics 4
Views|Google Analytics 4
Engagement Rate|Google Analytics 4
Conversions|Google Analytics 4
Qualified Leads|Google Analytics 4
Converted Leads|Google Analytics 4`

/** Deterministic pseudo-value so the demo list is stable across reloads. */
function demoValue(name: string, sourceLabel: string, index: number): string {
  const seed = ((index * 9301 + 49297) % 233280) / 233280
  if (KNOWN_VALUES[name] && sourceLabel.includes('Sample')) {
    return KNOWN_VALUES[name]
  }
  if (/Rate|Share/.test(name)) return `${(seed * 60 + 5).toFixed(1)}%`
  if (/Revenue|Amount|Price|Value|CPC|Cost/.test(name)) {
    return `$ ${(seed * 5000).toFixed(2)}`
  }
  return Math.round(seed * 9000 + 20).toLocaleString()
}

export const METRICS: Metric[] = RAW.split('\n').map((line, index) => {
  const [name, sourceLabel, kind = 'basic'] = line.split('|')
  const sources = sourceLabel.split(',').map((s) => s.trim())
  return {
    id: `metric-${index}`,
    name,
    sourceLabel,
    primarySource: sources[0],
    sources,
    kind: kind as MetricKind,
    value: demoValue(name, sourceLabel, index),
  }
})

/** Unique data-source names, for the "Data source" filter dropdown. */
export const METRIC_SOURCES: string[] = [...new Set(METRICS.flatMap((m) => m.sources))]

export interface MetricFilter {
  query: string
  /** 'all' | one of METRIC_SOURCES. */
  source: string
  /** 'all' | MetricKind. */
  show: string
}

/** Looks up a formatted demo value for a metric by name (Sample dataset first). */
export function metricValue(name: string): string {
  const sample = METRICS.find(
    (m) => m.name === name && m.sources.includes('Sample dataset'),
  )
  return (sample ?? METRICS.find((m) => m.name === name))?.value ?? '—'
}

/** Applies the search + source + kind filters to the metric list. */
export function filterMetrics(filter: MetricFilter): Metric[] {
  const q = filter.query.trim().toLowerCase()
  return METRICS.filter(
    (m) =>
      (!q ||
        m.name.toLowerCase().includes(q) ||
        m.sourceLabel.toLowerCase().includes(q)) &&
      (filter.source === 'all' || m.sources.includes(filter.source)) &&
      (filter.show === 'all' || m.kind === filter.show),
  )
}
