import { makeBlockFrom, metricCfg, type BlockConfig } from '../viz/engine'

const M = (name: string, breakdown = '', label?: string) => metricCfg(name, breakdown, label)
const B = (o: Partial<BlockConfig>): BlockConfig =>
  makeBlockFrom({ title: o.title ?? (o.metrics && o.metrics[0] ? o.metrics[0].label : ''), ...o })
const N = (name: string, size = 3, label?: string): BlockConfig => B({ type: 'number', size, metrics: [M(name, '', label)] })

export interface DashTemplate {
  cat: string
  n: string
  d: string
  /** CSS background for the preview tile. */
  bg: string
  /** Preview layout: [columnSpan, extraClasses?]. */
  layout: Array<[number, string?]>
  blocks: BlockConfig[]
}

export const TEMPLATES: DashTemplate[] = [
  // Starters
  { cat: 'Starters', n: 'KPI row', d: 'Four headline numbers', bg: 'linear-gradient(135deg,#EEF2FF,#F5F3FF)', layout: [[3], [3], [3], [3]], blocks: [N('Revenue'), N('Profit'), N('Orders'), N('Average Order Value', 3, 'Avg. order value')] },
  { cat: 'Starters', n: 'Hero metric', d: 'One big number with its trend', bg: 'linear-gradient(135deg,#E0E7FF,#FCE7F3)', layout: [[12, 'tall']], blocks: [B({ title: 'Revenue this month', type: 'number', size: 12, fz: 140, gradText: true, metrics: [M('Revenue')] })] },
  // Sales
  { cat: 'Sales', n: 'Sales trend', d: 'Revenue and profit over time', bg: 'linear-gradient(135deg,#E0F2FE,#EDE9FE)', layout: [[12, 'tall']], blocks: [B({ title: 'Revenue vs profit', type: 'line', size: 12, legend: true, metrics: [M('Revenue'), M('Profit')] })] },
  { cat: 'Sales', n: 'Channel mix', d: 'Where profit comes from', bg: 'linear-gradient(135deg,#FCE7F3,#FFE4E6)', layout: [[4, 'tall ring'], [8, 'tall']], blocks: [B({ title: 'Profit by channel', type: 'pie', size: 4, legend: true, metrics: [M('Profit', 'CHANNEL')] }), B({ title: 'Revenue by item', type: 'hbar', size: 8, metrics: [M('Revenue', 'ITEM')] })] },
  { cat: 'Sales', n: 'Product leaderboard', d: 'Best sellers with exact numbers', bg: 'linear-gradient(135deg,#FEF3C7,#FCE7F3)', layout: [[6, 'tall txt'], [6, 'tall']], blocks: [B({ title: 'Top products', type: 'table', size: 6, metrics: [M('Revenue', 'ITEM'), M('Quantity', 'ITEM')] }), B({ title: 'Units by category', type: 'bar', size: 6, metrics: [M('Quantity', 'CATEGORY')] })] },
  // Marketing
  { cat: 'Marketing', n: 'Funnel analysis', d: 'Drop-off from visit to purchase', bg: 'linear-gradient(135deg,#FFEDD5,#FCE7F3)', layout: [[6, 'tall funnel'], [6, 'tall txt']], blocks: [B({ title: 'Visit funnel', type: 'funnel', size: 6, metrics: [M('Visits', 'CHANNEL')] }), B({ title: 'Visits by channel', type: 'table', size: 6, metrics: [M('Visits', 'CHANNEL')] })] },
  { cat: 'Marketing', n: 'SEO snapshot', d: 'Rank, visibility and links', bg: 'linear-gradient(135deg,#1E1B4B,#312E81)', layout: [[3], [3], [3], [3]], blocks: [N('Average Rank'), N('Share of Voice'), N('Backlinks'), N('Ahrefs Rank')] },
  { cat: 'Marketing', n: 'Email health', d: 'List growth and deal value', bg: 'linear-gradient(135deg,#CCFBF1,#E0E7FF)', layout: [[4], [4], [4]], blocks: [N('Contacts', 4), B({ title: 'Deals won vs goal', type: 'progress', size: 4, metrics: [M('Won Deals Count')] }), B({ title: 'New contacts', type: 'line', size: 4, grid: false, metrics: [M('New Contacts')] })] },
  { cat: 'Marketing', n: 'Weekly pattern', d: 'Busy days and weekly volume', bg: 'linear-gradient(135deg,#E0F2FE,#DCFCE7)', layout: [[6, 'tall heat'], [6, 'tall']], blocks: [B({ title: 'Orders by day', type: 'heatmap', size: 6, metrics: [M('Orders')] }), B({ title: 'Orders per day', type: 'bar', size: 6, metrics: [M('Orders')] })] },
  // Goals
  { cat: 'Goals', n: 'Goals tracker', d: 'Targets for the month', bg: 'linear-gradient(135deg,#FEF9C3,#FED7AA)', layout: [[4, 'tall ring'], [4, 'tall ring'], [4, 'tall']], blocks: [B({ title: 'AOV vs target', type: 'gauge', size: 4, metrics: [M('Average Order Value')] }), B({ title: 'Revenue goal', type: 'progress', size: 4, metrics: [M('Revenue')] }), B({ title: 'Orders goal', type: 'progress', size: 4, metrics: [M('Orders')] })] },
  { cat: 'Goals', n: 'Target rings', d: 'Segments as progress rings', bg: 'linear-gradient(135deg,#FDF2F8,#EDE9FE)', layout: [[6, 'tall ring'], [6, 'tall ring']], blocks: [B({ title: 'Profit by channel', type: 'radial', size: 6, legend: true, metrics: [M('Profit', 'CHANNEL')] }), B({ title: 'Spend balance', type: 'spider', size: 6, metrics: [M('Revenue', 'CATEGORY')] })] },
]

export const TEMPLATE_CATS = ['All', ...new Set(TEMPLATES.map((t) => t.cat))]
