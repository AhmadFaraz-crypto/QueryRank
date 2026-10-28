import { makeBlockFrom, metricCfg, type BlockConfig } from '../viz/engine'
import { presetBg, presetThemeVars, themeBg, themeVars, type Theme } from '../viz/theme'

const M = (name: string, breakdown = '', label?: string) =>
  metricCfg(name, breakdown, label)
const B = (o: Partial<BlockConfig>): BlockConfig =>
  makeBlockFrom({
    title: o.title ?? (o.metrics && o.metrics[0] ? o.metrics[0].label : ''),
    ...o,
  })
const N = (name: string, size = 3, label?: string): BlockConfig =>
  B({ type: 'number', size, metrics: [M(name, '', label)] })

export interface Dashboard {
  id: string
  n: string
  d?: string
  cat: string
  sub?: string
  /** Theme preset name. */
  theme: string
  badge?: string
  blocks: BlockConfig[]
  updated?: number
  /** Full theme state when edited in the designer. */
  themeState?: Theme | null
}

// Every template follows the Sample Dashboard's "proper cards" language — three
// balanced rows of full cards mixing sparkline KPIs, a hero chart, a bubble or
// donut, and a gauge/table — but each has its own skeleton and chart set so no
// two read the same. `bubble`/`pie`/`hbar`/`table` cards take a breakdown metric
// (the segments they split by). See [[template-design]].
export const DASH_TEMPLATES: Dashboard[] = [
  {
    id: 'gsc',
    n: 'Search Console performance',
    cat: 'SEO',
    theme: 'Clean',
    badge: 'New',
    d: 'Organic clicks, impressions, CTR and position, with top queries, pages and devices.',
    // [ line hero · Clicks ] / [ Impressions · CTR · Position · device donut ] / [ top pages · top queries ]
    blocks: [
      B({ title: 'Organic clicks', type: 'line', size: 8, metrics: [M('Clicks')] }),
      N('Clicks', 4),
      N('Impressions', 3),
      N('CTR', 3),
      N('Average Position', 3, 'Avg. position'),
      B({
        title: 'Clicks by device',
        type: 'pie',
        size: 3,
        legend: true,
        metrics: [M('Clicks', 'DEVICE')],
      }),
      B({ title: 'Top pages', type: 'hbar', size: 6, metrics: [M('Clicks', 'PAGE')] }),
      B({
        title: 'Top queries',
        type: 'table',
        size: 6,
        metrics: [M('Clicks', 'QUERY'), M('Impressions', 'QUERY')],
      }),
    ],
  },
  {
    id: 'gsc-queries',
    n: 'Search queries',
    cat: 'SEO',
    theme: 'Midnight',
    d: 'Which search terms drive clicks and impressions, with CTR and position.',
    // [ Clicks · Impressions · clicks bar hero ] / [ query table · CTR gauge ] / [ query bars · query bubbles ]
    blocks: [
      N('Clicks', 3),
      N('Impressions', 3),
      B({ title: 'Clicks per day', type: 'bar', size: 6, metrics: [M('Clicks')] }),
      B({
        title: 'Top queries',
        type: 'table',
        size: 8,
        metrics: [M('Clicks', 'QUERY'), M('Impressions', 'QUERY')],
      }),
      B({ title: 'CTR', type: 'gauge', size: 4, metrics: [M('CTR')] }),
      B({ title: 'Clicks by query', type: 'hbar', size: 6, metrics: [M('Clicks', 'QUERY')] }),
      B({
        title: 'Queries by impressions',
        type: 'bubble',
        size: 6,
        legend: true,
        metrics: [M('Impressions', 'QUERY')],
      }),
    ],
  },
  {
    id: 'gsc-pages',
    n: 'Pages & devices',
    cat: 'SEO',
    theme: 'Peach',
    d: 'Top landing pages and the device split for your organic search traffic.',
    // Databox-style: a left rail of stacked KPI stats · a hero bar + device
    // donuts in the middle · a clicks trend over a page-bubble chart down the right.
    // [ Clicks       | Top pages (tall)      | Clicks per day ]
    // [ Impressions  |                       |                ]
    // [ CTR          | device + device donut | Pages bubbles  ]
    // [ Avg position |                       |                ]
    blocks: [
      N('Clicks', 3),
      B({ title: 'Top pages by clicks', type: 'hbar', size: 6, h: 2, metrics: [M('Clicks', 'PAGE')] }),
      B({ title: 'Clicks per day', type: 'bar', size: 3, h: 2, metrics: [M('Clicks')] }),
      N('Impressions', 3),
      N('CTR', 3),
      B({
        title: 'Clicks by device',
        type: 'pie',
        size: 3,
        h: 2,
        legend: true,
        metrics: [M('Clicks', 'DEVICE')],
      }),
      B({
        title: 'Impressions by device',
        type: 'pie',
        size: 3,
        h: 2,
        legend: true,
        metrics: [M('Impressions', 'DEVICE')],
      }),
      B({
        title: 'Pages by impressions',
        type: 'bubble',
        size: 3,
        h: 2,
        legend: true,
        metrics: [M('Impressions', 'PAGE')],
      }),
      N('Average Position', 3, 'Avg. position'),
    ],
  },
  {
    id: 'ga4',
    n: 'Website traffic (GA4)',
    cat: 'Marketing',
    theme: 'Aurora',
    badge: 'New',
    d: 'Sessions, users, views and engagement with channel mix, from Google Analytics 4.',
    // [ Sessions · Users · sessions line hero ] / [ views bar hero · Views · Engagement ] / [ channel donut · channel bubbles ]
    blocks: [
      N('Sessions', 3),
      N('Active Users', 3, 'Users'),
      B({ title: 'Sessions over time', type: 'line', size: 6, metrics: [M('Sessions')] }),
      B({ title: 'Views per day', type: 'bar', size: 6, metrics: [M('Views')] }),
      N('Views', 3),
      N('Engagement Rate', 3, 'Engagement rate'),
      B({
        title: 'Traffic by channel',
        type: 'pie',
        size: 6,
        legend: true,
        metrics: [M('Sessions', 'CHANNEL')],
      }),
      B({
        title: 'Channels by sessions',
        type: 'bubble',
        size: 6,
        legend: true,
        metrics: [M('Sessions', 'CHANNEL')],
      }),
    ],
  },
  {
    id: 'ga4-leads',
    n: 'Leads overview',
    cat: 'Marketing',
    theme: 'Ocean',
    badge: 'New',
    d: 'New and returning users, qualified and converted leads, with the channel mix — from a GA4 leads export.',
    // [ New users · Returning users · new-users line hero ] / [ qualified bar hero · Qualified · Converted ] / [ channel donut · channel bubbles ]
    blocks: [
      N('New Users', 3),
      N('Returning Users', 3),
      B({ title: 'New users over time', type: 'line', size: 6, metrics: [M('New Users')] }),
      B({ title: 'Qualified leads per day', type: 'bar', size: 6, metrics: [M('Qualified Leads')] }),
      N('Qualified Leads', 3),
      N('Converted Leads', 3),
      B({
        title: 'New users by channel',
        type: 'pie',
        size: 6,
        legend: true,
        metrics: [M('New Users', 'CHANNEL')],
      }),
      B({
        title: 'Channels by new users',
        type: 'bubble',
        size: 6,
        legend: true,
        metrics: [M('New Users', 'CHANNEL')],
      }),
    ],
  },
  {
    id: 'ga4-channels',
    n: 'Acquisition channels',
    cat: 'Marketing',
    theme: 'Sunset',
    d: 'Where your sessions come from, by default channel group, from GA4.',
    // [ channel donut · Sessions · Users ] / [ channel bars · Engagement gauge ] / [ channel bubbles · sessions line ]
    blocks: [
      B({
        title: 'Sessions by channel',
        type: 'pie',
        size: 4,
        legend: true,
        metrics: [M('Sessions', 'CHANNEL')],
      }),
      N('Sessions', 4),
      N('Active Users', 4, 'Users'),
      B({
        title: 'Channel breakdown',
        type: 'hbar',
        size: 8,
        metrics: [M('Sessions', 'CHANNEL')],
      }),
      B({ title: 'Engagement rate', type: 'gauge', size: 4, metrics: [M('Engagement Rate')] }),
      B({
        title: 'Channels by views',
        type: 'bubble',
        size: 6,
        legend: true,
        metrics: [M('Views', 'CHANNEL')],
      }),
      B({ title: 'Sessions over time', type: 'line', size: 6, metrics: [M('Sessions')] }),
    ],
  },
  {
    id: 'ga4-engagement',
    n: 'Audience & engagement',
    cat: 'Marketing',
    theme: 'Forest',
    d: 'Users, views and engagement trends for your GA4 property.',
    // [ users line hero · Sessions · Users ] / [ Views · Engagement · channel donut ] / [ views bar · Engagement gauge ]
    blocks: [
      B({ title: 'Users over time', type: 'line', size: 6, metrics: [M('Active Users')] }),
      N('Sessions', 3),
      N('Active Users', 3, 'Users'),
      N('Views', 3),
      N('Engagement Rate', 3, 'Engagement rate'),
      B({
        title: 'Traffic by channel',
        type: 'pie',
        size: 6,
        legend: true,
        metrics: [M('Sessions', 'CHANNEL')],
      }),
      B({ title: 'Views per day', type: 'bar', size: 8, metrics: [M('Views')] }),
      B({ title: 'Engagement rate', type: 'gauge', size: 4, metrics: [M('Engagement Rate')] }),
    ],
  },
]

export const DASH_CATS = ['All', ...new Set(DASH_TEMPLATES.map((t) => t.cat))]

/** The user's starting "my dashboard" — the sample store dashboard. */
export function sampleMyDashboard(blocks: BlockConfig[]): Dashboard {
  return {
    id: 'sample',
    n: 'Sample Dashboard',
    d: 'Store performance with sample data.',
    cat: 'E-commerce',
    sub: 'Store performance',
    theme: 'Clean',
    blocks,
    updated: Date.now() - 4 * 60000,
  }
}

/** The CSS vars + background a dashboard should render with. */
export function dashboardView(dash: Dashboard): {
  vars: Record<string, string>
  bg: string
} {
  return dash.themeState
    ? { vars: themeVars(dash.themeState), bg: themeBg(dash.themeState) }
    : { vars: presetThemeVars(dash.theme), bg: presetBg(dash.theme) }
}
