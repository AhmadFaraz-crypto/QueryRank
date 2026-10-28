import { describe, expect, it } from 'vitest'
import {
  analyzeTable,
  buildFromFiles,
  detectKind,
  parseCsv,
  unzipCsvs,
  type ParsedFile,
} from './dataImport'

describe('parseCsv', () => {
  it('splits simple rows', () => {
    expect(parseCsv('a,b\n1,2\n3,4')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ])
  })

  it('handles quoted fields with commas and CRLF', () => {
    expect(parseCsv('a,b\r\n"x,y",z\r\n')).toEqual([
      ['a', 'b'],
      ['x,y', 'z'],
    ])
  })

  it('handles escaped quotes', () => {
    expect(parseCsv('"he said ""hi""",2')).toEqual([['he said "hi"', '2']])
  })
})

describe('analyzeTable — GSC', () => {
  const dates = analyzeTable(
    'Dates.csv',
    'Date,Clicks,Impressions,CTR,Position\n2026-10-01,320,9000,2.80%,7.4\n2026-10-02,384,9300,3.00%,7.7',
  )

  it('detects the date column and daily metrics', () => {
    expect(dates.ok).toBe(true)
    expect(dates.days).toBe(2)
    const roles = Object.fromEntries(dates.cols.map((c) => [c.h, c.role]))
    expect(roles.Date).toBe('date')
    expect(roles.Clicks).toBe('metric')
  })

  it('maps known metrics to canonical names + aggregation', () => {
    const byName = Object.fromEntries(dates.cols.map((c) => [c.h, c]))
    expect(byName.Clicks.name).toBe('Clicks')
    expect(byName.Clicks.agg).toBe('sum')
    expect(byName.CTR.name).toBe('CTR')
    expect(byName.CTR.agg).toBe('avg') // rates average, not sum
    expect(byName.CTR.fmt).toBe('percent')
    expect(byName.Position.name).toBe('Average Position')
    expect(byName.Position.agg).toBe('avg')
  })

  it('recognises a breakdown export ("Top queries")', () => {
    const q = analyzeTable('Queries.csv', 'Top queries,Clicks,Impressions\nshoes,3240,98400\nboots,1240,41800')
    const dim = q.cols.find((c) => c.role === 'dim')
    expect(dim?.dim).toBe('QUERY')
    expect(q.cols.filter((c) => c.role === 'metric')).toHaveLength(2)
  })
})

describe('analyzeTable — GA4', () => {
  it('skips the "#" preamble and finds the table', () => {
    const f = analyzeTable(
      'traffic.csv',
      '# GA4 export\n# Date range: 20261001-20261014\n\nDate,Sessions,Active users,Views,Engagement rate\n2026-10-01,1400,1022,4760,0.5500',
    )
    expect(f.ok).toBe(true)
    const names = f.cols.filter((c) => c.role === 'metric').map((c) => c.name)
    expect(names).toEqual(['Sessions', 'Active Users', 'Views', 'Engagement Rate'])
  })

  it('does not mistake "Screen page views" for a Page breakdown', () => {
    const f = analyzeTable('landing.csv', 'Landing page,Screen page views,Sessions\n/home,5600,1820\n/blog,3100,940')
    const dim = f.cols.find((c) => c.role === 'dim')
    expect(dim?.h).toBe('Landing page')
    expect(dim?.dim).toBe('PAGE')
    // the "views" column is a metric, not a second dimension
    expect(f.cols.find((c) => c.h === 'Screen page views')?.role).toBe('metric')
  })
})

describe('analyzeTable — generic + edge cases', () => {
  it('classifies unknown numeric columns as metrics and text as breakdowns', () => {
    const f = analyzeTable('sales.csv', 'Region,Revenue\nEurope,1200\nAsia,900')
    const region = f.cols.find((c) => c.h === 'Region')
    const rev = f.cols.find((c) => c.h === 'Revenue')
    expect(region?.role).toBe('dim')
    expect(rev?.role).toBe('metric')
  })

  it('flags a file with no numeric columns as a warning', () => {
    const f = analyzeTable('labels.csv', 'Name,Note\nfoo,bar\nbaz,qux')
    expect(f.ok).toBe(false)
    expect(f.status).toBe('warn')
  })

  it('returns an error for an empty / unreadable file', () => {
    expect(analyzeTable('empty.csv', '').status).toBe('err')
  })
})

describe('buildFromFiles', () => {
  const files: ParsedFile[] = [
    analyzeTable('Dates.csv', 'Date,Clicks,CTR\n2026-10-01,100,2.0%\n2026-10-02,200,4.0%\n2026-10-03,300,3.0%'),
    analyzeTable('Pages.csv', 'Top pages,Clicks\nhttps://ex.com/running-shoes,900\nhttps://ex.com/,100'),
    analyzeTable('Devices.csv', 'Device,Clicks\nMOBILE,780\nDESKTOP,220'),
  ]
  const ds = buildFromFiles(files, 'gsc', 'My GSC', 1000)

  it('sums a volume metric into a daily series', () => {
    expect(ds.series.Clicks.total).toBe(600) // 100 + 200 + 300
    expect(ds.series.Clicks.avg).toBe(false)
  })

  it('averages a rate metric instead of summing it', () => {
    expect(ds.series.CTR.avg).toBe(true)
    expect(ds.series.CTR.total).toBeCloseTo(3.0, 5) // mean of 2,4,3
  })

  it('builds breakdowns and prettifies labels (URL→path, MOBILE→Mobile)', () => {
    expect(ds.cats['Clicks|PAGE']).toEqual([
      ['/running-shoes', 900],
      ['/', 100],
    ])
    expect(ds.cats['Clicks|DEVICE']).toEqual([
      ['Mobile', 780],
      ['Desktop', 220],
    ])
  })

  it('sets a stable id and the source label', () => {
    expect(ds.id).toBe('ds_1000')
    expect(ds.source).toBe('Google Search Console')
  })
})

describe('detectKind', () => {
  it('recognises GSC and GA4 exports, else null', () => {
    expect(detectKind('Date,Clicks,Impressions,CTR,Position\n')).toBe('gsc')
    expect(detectKind('Date,Sessions,Engagement rate\n')).toBe('ga4')
    expect(detectKind('Region,Revenue\n')).toBe(null)
  })
})

describe('unzipCsvs', () => {
  it('reads CSV entries out of a (stored) ZIP', async () => {
    const buf = storedZip([
      { name: 'Dates.csv', text: 'Date,Clicks\n2026-10-01,10' },
      { name: 'Queries.csv', text: 'Top queries,Clicks\nshoes,5' },
    ])
    const entries = await unzipCsvs(buf)
    expect(entries.map((e) => e.name)).toEqual(['Dates.csv', 'Queries.csv'])
    expect(entries[1].text).toContain('shoes,5')
  })
})

/** Build a minimal uncompressed (stored) ZIP — enough to exercise unzipCsvs,
 *  which ignores CRCs and only inflates deflated (method 8) entries. */
function storedZip(files: Array<{ name: string; text: string }>): ArrayBuffer {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Array<{ name: Uint8Array; len: number; offset: number }> = []
  let offset = 0
  for (const f of files) {
    const name = enc.encode(f.name)
    const data = enc.encode(f.text)
    const lh = new DataView(new ArrayBuffer(30))
    lh.setUint32(0, 0x04034b50, true)
    lh.setUint16(4, 20, true)
    lh.setUint16(8, 0, true) // method: stored
    lh.setUint32(14, 0, true) // crc (ignored)
    lh.setUint32(18, data.length, true)
    lh.setUint32(22, data.length, true)
    lh.setUint16(26, name.length, true)
    parts.push(new Uint8Array(lh.buffer), name, data)
    central.push({ name, len: data.length, offset })
    offset += 30 + name.length + data.length
  }
  const cdStart = offset
  for (const c of central) {
    const ch = new DataView(new ArrayBuffer(46))
    ch.setUint32(0, 0x02014b50, true)
    ch.setUint16(4, 20, true)
    ch.setUint16(6, 20, true)
    ch.setUint16(10, 0, true) // method
    ch.setUint32(20, c.len, true)
    ch.setUint32(24, c.len, true)
    ch.setUint16(28, c.name.length, true)
    ch.setUint32(42, c.offset, true)
    parts.push(new Uint8Array(ch.buffer), c.name)
    offset += 46 + c.name.length
  }
  const eo = new DataView(new ArrayBuffer(22))
  eo.setUint32(0, 0x06054b50, true)
  eo.setUint16(8, central.length, true)
  eo.setUint16(10, central.length, true)
  eo.setUint32(12, offset - cdStart, true)
  eo.setUint32(16, cdStart, true)
  parts.push(new Uint8Array(eo.buffer))
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out.buffer
}
