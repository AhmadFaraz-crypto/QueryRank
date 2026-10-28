import { afterEach, describe, expect, it } from 'vitest'
import {
  blockData,
  clearLiveData,
  makeBlockFrom,
  metricCfg,
  rangeName,
  type BlockConfig,
} from './engine'
import { applyDatasets, type ImportedDataset } from '../dataImport'

// blockData reads the module-level live-data registry, so every test resets it.
afterEach(() => {
  clearLiveData()
})

const block = (name: string, breakdown = '', date = 'LastX'): BlockConfig =>
  makeBlockFrom({ type: 'number', date, metrics: [metricCfg(name, breakdown)] })
const total = (b: BlockConfig) => blockData(b).ms[0].total

describe('rangeName', () => {
  it('labels the known ranges', () => {
    expect(rangeName('LastX')).toBe('Last 30 days')
    expect(rangeName('Last7')).toBe('Last 7 days')
    expect(rangeName('WeekToDate')).toBe('This week')
    expect(rangeName('cust:14')).toBe('Custom range')
    expect(rangeName('nonsense')).toBe('Last 30 days') // safe fallback
  })
})

describe('date range affects a volume series', () => {
  it('a 7-day window totals less than a 30-day window', () => {
    const t7 = total(block('Clicks', '', 'Last7'))
    const t30 = total(block('Clicks', '', 'LastX'))
    expect(t7).toBeLessThan(t30)
    expect(t7 / t30).toBeCloseTo(7 / 30, 1)
  })
})

describe('a breakdown chart splits into its dimension rows', () => {
  it('renders one row per device', () => {
    const cats = blockData(block('Clicks', 'DEVICE')).ms[0].cats
    expect(cats).toHaveLength(3)
    expect(cats[0][0]).toBe('Mobile')
  })
})

describe('imported/live data overrides the registry', () => {
  it('renders the dataset total, then reverts after clearing', () => {
    const base = total(block('Clicks'))
    const ds: ImportedDataset = {
      id: 'ds_test',
      name: 'test',
      source: 'Google Search Console',
      createdAt: 0,
      series: {
        Clicks: { vals: [1, 2, 3], total: 4321, prev: 4000, unit: '', avg: false, target: 5000 },
      },
      cats: {},
      report: [],
    }
    applyDatasets([ds])
    expect(total(block('Clicks'))).toBe(4321)
    clearLiveData()
    expect(total(block('Clicks'))).toBeCloseTo(base, 5)
  })
})
