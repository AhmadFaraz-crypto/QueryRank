import { useMemo, useRef, useState, type DragEvent } from 'react'
import { useStore } from './AppStore'
import {
  analyzeFiles,
  analyzeTable,
  buildFromFiles,
  datasetSummary,
  detectKind,
  DIM_OPTIONS,
  KINDS,
  ROLE_COLOR,
  type ColRole,
  type ImportColumn,
  type ImportKind,
  type ParsedFile,
} from './dataImport'
import styles from './ImportWizard.module.scss'

const STEPS = ['Source', 'Upload', 'Map columns', 'Review']
const title = (d: string) => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase()

export function ImportWizard({ onClose }: { onClose: () => void }) {
  const { datasets, importDataset, removeDataset } = useStore()
  const [step, setStep] = useState(1)
  const [kind, setKind] = useState<ImportKind>('gsc')
  const [files, setFiles] = useState<ParsedFile[]>([])
  const [active, setActive] = useState(0)
  const [dsName, setDsName] = useState('')
  const [mode, setMode] = useState<'replace' | 'keep'>('replace')
  const [done, setDone] = useState<{ metrics: number; files: number; source: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const okFiles = files.filter((f) => f.ok)

  const addFiles = async (picked: File[]) => {
    if (!picked.length) return
    setBusy(true)
    try {
      const parsed = await analyzeFiles(picked)
      // Auto-detect the source from the first readable file.
      const first = picked.find((f) => /\.csv$/i.test(f.name))
      if (first) {
        const k = detectKind(await first.text())
        if (k) setKind(k)
      }
      setFiles((prev) => [...prev, ...parsed])
    } finally {
      setBusy(false)
    }
  }

  const useSample = () => {
    const parsed = SAMPLES[kind].map((s) => analyzeTable(s.name, s.text))
    setFiles(parsed)
  }

  const updateCol = (fileIdx: number, colIdx: number, patch: Partial<ImportColumn>) => {
    setFiles((prev) =>
      prev.map((f, fi) => {
        if (fi !== fileIdx) return f
        const cols = f.cols.map((c, ci) => (ci === colIdx ? { ...c, ...patch } : c))
        // Only one date column per file.
        if (patch.role === 'date')
          cols.forEach((c, ci) => {
            if (ci !== colIdx && c.role === 'date') {
              c.role = 'ignore'
              c.on = false
            }
          })
        if (patch.role) patch.on = patch.role !== 'ignore'
        if (patch.on !== undefined) cols[colIdx].on = patch.on
        const metrics = cols.filter((c) => c.on && c.role === 'metric').length
        const dims = cols.filter((c) => c.on && c.role === 'dim').length
        return {
          ...f,
          cols,
          ok: metrics > 0,
          status: metrics > 0 ? 'ok' : dims ? 'warn' : 'err',
        }
      }),
    )
  }

  const plan = useMemo(() => {
    const metrics = new Set<string>()
    const dims = new Set<string>()
    okFiles.forEach((f) => {
      f.cols.forEach((c) => {
        if (c.on && c.role === 'metric') metrics.add(c.name)
        if (c.on && c.role === 'dim') dims.add(c.dim)
      })
    })
    return { metrics: [...metrics], dims: [...dims] }
  }, [okFiles])

  const defaultName = kind === 'csv' ? okFiles[0]?.label || 'CSV import' : KINDS[kind].name

  const canNext = step === 1 ? true : step === 2 ? okFiles.length > 0 : true
  const next = () => {
    if (step < 4) {
      if (step === 3 && !dsName) setDsName(defaultName)
      setStep(step + 1)
      return
    }
    doImport()
  }

  const doImport = () => {
    const name = dsName || defaultName
    const ds = buildFromFiles(okFiles, kind, name, Date.now())
    if (mode === 'replace')
      datasets.filter((d) => d.source === ds.source && d.id !== ds.id).forEach((d) => removeDataset(d.id))
    importDataset(ds)
    setDone({
      metrics: Object.keys(ds.series).length + Object.keys(ds.cats).length,
      files: okFiles.length,
      source: ds.source,
    })
  }

  const reset = () => {
    setFiles([])
    setStep(1)
    setDsName('')
    setDone(null)
  }

  const K = KINDS[kind]

  return (
    <div className={styles.imp} onMouseDown={onClose}>
      <div className={styles.win} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <header className={styles.head}>
          <span className={styles.stIco}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
              <path d="M14 3v5h5M12 18v-6m0 0l-3 3m3-3l3 3" />
            </svg>
          </span>
          <div className={styles.ttl}>
            <b>Import data from CSV</b>
            <small>Google Analytics 4, Search Console or any spreadsheet export</small>
          </div>
          <button className={styles.iconBtn} onClick={onClose} aria-label="Close">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <nav className={styles.stepper}>
          {STEPS.map((s, k) => {
            const state = done && step === 4 ? 'done' : step === k + 1 ? 'on' : step > k + 1 ? 'done' : ''
            return (
              <div key={s} className={styles.stpWrap}>
                {k > 0 && <span className={`${styles.stpLine} ${step > k ? styles.lineDone : ''}`} />}
                <span className={`${styles.stp} ${state === 'on' ? styles.stpOn : ''} ${state === 'done' ? styles.stpDone : ''}`}>
                  <i>{state === 'done' ? '✓' : k + 1}</i>
                  {s}
                </span>
              </div>
            )
          })}
        </nav>

        <div className={styles.body}>
          {/* 1 — SOURCE */}
          {step === 1 && (
            <section>
              <div className={styles.h2}>Where is this file from?</div>
              <p className={styles.p}>
                We recognise exports from these tools automatically, so most files need no setup.
              </p>
              <div className={styles.src3}>
                {(Object.keys(KINDS) as ImportKind[]).map((k) => (
                  <button
                    key={k}
                    className={kind === k ? styles.srcOn : ''}
                    onClick={() => setKind(k)}
                    onDoubleClick={() => {
                      setKind(k)
                      setStep(2)
                    }}
                  >
                    <span className={styles.lg} style={{ background: KINDS[k].bg }}>
                      {KINDS[k].tag}
                    </span>
                    <b>{KINDS[k].name}</b>
                    <p>{KINDS[k].desc}</p>
                    <span className={styles.files}>
                      {KINDS[k].files.map((f) => (
                        <span key={f}>{f}</span>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
              <div className={styles.howto}>
                <ol>
                  <h4>How to export from {K.name}</h4>
                  {K.how.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ol>
                <div className={styles.liveTip}>
                  {kind === 'csv' ? (
                    <>
                      <b>Good to know</b>
                      <p>
                        Each import becomes its own data source. Upload a newer file later to refresh
                        it.
                      </p>
                    </>
                  ) : (
                    <>
                      <b>Want it to update by itself?</b>
                      <p>
                        A CSV import is a snapshot. Connect {K.short} directly (with your own keys)
                        and dashboards refresh on their own.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* 2 — UPLOAD */}
          {step === 2 && (
            <section>
              <div className={styles.h2}>Upload your {K.short} files</div>
              <p className={styles.p}>
                Drop the CSVs (or the ZIP from Search Console). We’ll figure out the columns.
              </p>
              <label
                className={`${styles.bigdrop} ${over ? styles.over : ''}`}
                onDragOver={(e: DragEvent) => {
                  e.preventDefault()
                  setOver(true)
                }}
                onDragLeave={() => setOver(false)}
                onDrop={(e: DragEvent) => {
                  e.preventDefault()
                  setOver(false)
                  addFiles([...e.dataTransfer.files])
                }}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.zip,text/csv"
                  multiple
                  hidden
                  onChange={(e) => e.target.files && addFiles([...e.target.files])}
                />
                <div className={styles.ic}>
                  <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M12 16V4m0 0l-4 4m4-4l4 4" />
                    <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                  </svg>
                </div>
                <b>{busy ? 'Reading…' : 'Drop CSV or ZIP files here'}</b>
                <small>
                  or <u>browse your computer</u> · several at once · up to 10 MB each
                </small>
              </label>
              <div className={styles.sampleRow}>
                No export handy?
                <button onClick={useSample}>Use a sample {K.short} export</button>
              </div>
              {files.length > 0 && (
                <div className={styles.flist}>
                  {files.map((f, i) => (
                    <div key={i} className={`${styles.fitem} ${f.status === 'err' ? styles.fErr : ''}`}>
                      <span className={styles.fi}>CSV</span>
                      <div style={{ minWidth: 0 }}>
                        <b>{f.name}</b>
                        <small>{f.note}</small>
                      </div>
                      <span className={`${styles.tag} ${styles['tag_' + f.status]}`}>
                        {f.status === 'ok' ? 'Ready' : f.status === 'warn' ? 'No metrics' : 'Unreadable'}
                      </span>
                      <button
                        className={styles.x}
                        aria-label="Remove file"
                        onClick={() => setFiles((prev) => prev.filter((_, k) => k !== i))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 3 — MAP */}
          {step === 3 && <MapStep files={files} active={active} setActive={setActive} updateCol={updateCol} />}

          {/* 4 — REVIEW / DONE */}
          {step === 4 &&
            (done ? (
              <div className={styles.doneBox}>
                <div className={styles.okCircle}>
                  <svg width="34" height="34" fill="none" stroke="#fff" strokeWidth="3" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2>{done.metrics} metrics imported</h2>
                <p>
                  From {done.files} file{done.files > 1 ? 's' : ''}. They’re rendering now under{' '}
                  <b>{done.source}</b>.
                </p>
                <div className={styles.acts3}>
                  <button className={styles.primary} onClick={onClose}>
                    View dashboards
                  </button>
                  <button className={styles.ghost} onClick={reset}>
                    Import another file
                  </button>
                </div>
              </div>
            ) : (
              <section>
                <div className={styles.h2}>Review and import</div>
                <p className={styles.p}>
                  {plan.metrics.length} metric{plan.metrics.length === 1 ? '' : 's'} from{' '}
                  {okFiles.length} file{okFiles.length > 1 ? 's' : ''}
                </p>
                <div className={styles.rv}>
                  <div style={{ display: 'grid', gap: 16 }}>
                    <div className={styles.field}>
                      <label>Data source name</label>
                      <input value={dsName || defaultName} onChange={(e) => setDsName(e.target.value)} />
                    </div>
                    <div className={styles.rvCard}>
                      <div className={styles.ph2}>Metrics</div>
                      <div className={styles.mchips}>
                        {plan.metrics.map((m) => (
                          <span key={m}>{m}</span>
                        ))}
                      </div>
                      <div className={styles.ph2}>Breakdowns</div>
                      <div className={styles.mchips}>
                        {plan.dims.length ? (
                          plan.dims.map((d) => (
                            <span key={d} className={styles.dm}>
                              {title(d)}
                            </span>
                          ))
                        ) : (
                          <span className={styles.none}>None</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div className={styles.ph2} style={{ marginTop: 0 }}>
                      If this source already exists
                    </div>
                    <div className={styles.radio}>
                      <label>
                        <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} />
                        <span>
                          Replace it
                          <small>This upload becomes the single {K.name} source</small>
                        </span>
                      </label>
                      <label>
                        <input type="radio" checked={mode === 'keep'} onChange={() => setMode('keep')} />
                        <span>
                          Keep both
                          <small>Add alongside any earlier imports</small>
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </section>
            ))}
        </div>

        <footer className={styles.foot}>
          <span className={styles.info}>
            {step === 2 && okFiles.length
              ? `${okFiles.length} file${okFiles.length > 1 ? 's' : ''} ready`
              : step === 4 && !done
                ? datasetSummary(buildFromFiles(okFiles, kind, dsName || defaultName, 0))
                : ''}
          </span>
          <span className={styles.sp} />
          {!done && (
            <>
              <button className={styles.ghost} disabled={step === 1} onClick={() => setStep(step - 1)}>
                Back
              </button>
              <button className={styles.primary} disabled={!canNext} onClick={next}>
                {step === 4 ? 'Import' : 'Continue'}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  )
}

function MapStep({
  files,
  active,
  setActive,
  updateCol,
}: {
  files: ParsedFile[]
  active: number
  setActive: (n: number) => void
  updateCol: (fi: number, ci: number, patch: Partial<ImportColumn>) => void
}) {
  const ok = files.map((f, i) => ({ f, i })).filter((x) => x.f.ok)
  const sel = ok.find((x) => x.i === active) ?? ok[0]
  if (!sel) return <p className={styles.p}>No readable files.</p>
  const { f, i: fi } = sel
  const dateCol = f.cols.find((c) => c.on && c.role === 'date')
  return (
    <section>
      <div className={styles.h2}>Check the columns</div>
      <p className={styles.p}>
        We guessed what each column is. Rename a metric, switch one off, or change how it’s combined.
      </p>
      <div className={styles.ftabs}>
        {ok.map(({ f: x, i }) => (
          <button key={i} className={active === i ? styles.tabOn : ''} onClick={() => setActive(i)}>
            {x.name} <em>{x.cols.filter((c) => c.on && c.role === 'metric').length} metrics</em>
          </button>
        ))}
      </div>
      <div className={styles.mapinfo}>
        <span>{f.label}</span>
        {dateCol ? (
          <span className={styles.dt}>📅 Daily{f.range ? ` · ${f.range}` : ''} · {f.days} days</span>
        ) : (
          <span>Totals &amp; breakdowns only</span>
        )}
        <span>{f.rows.length.toLocaleString()} rows</span>
      </div>
      <table className={styles.maptbl}>
        <thead>
          <tr>
            <th style={{ width: 40 }}>Use</th>
            <th>Column in file</th>
            <th style={{ width: 140 }}>Type</th>
            <th>Name in QueryRank</th>
            <th style={{ width: 110 }}>Combine by</th>
          </tr>
        </thead>
        <tbody>
          {f.cols.map((c, ci) => (
            <tr key={ci} className={!c.on ? styles.off : ''}>
              <td>
                <input type="checkbox" checked={c.on} onChange={(e) => updateCol(fi, ci, { on: e.target.checked })} />
              </td>
              <td className={styles.col}>
                <b>{c.h}</b>
                <small>{c.sample.join(' · ')}</small>
              </td>
              <td>
                <span className={styles.role}>
                  <i style={{ background: ROLE_COLOR[c.role] }} />
                  <select value={c.role} onChange={(e) => updateCol(fi, ci, { role: e.target.value as ColRole })}>
                    <option value="metric">Metric</option>
                    <option value="dim">Breakdown</option>
                    <option value="date">Date</option>
                    <option value="ignore">Ignore</option>
                  </select>
                </span>
              </td>
              <td>
                {c.role === 'metric' ? (
                  <input value={c.name} onChange={(e) => updateCol(fi, ci, { name: e.target.value })} />
                ) : c.role === 'dim' ? (
                  <select value={c.dim} onChange={(e) => updateCol(fi, ci, { dim: e.target.value })}>
                    {DIM_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d.charAt(0) + d.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                ) : c.role === 'date' ? (
                  <span className={styles.dateHint}>Used for trends</span>
                ) : (
                  <span className={styles.muted}>Not imported</span>
                )}
              </td>
              <td>
                {c.role === 'metric' ? (
                  <select value={c.agg} onChange={(e) => updateCol(fi, ci, { agg: e.target.value as 'sum' | 'avg' })}>
                    <option value="sum">Sum</option>
                    <option value="avg">Average</option>
                  </select>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.ph2}>Preview · first rows</div>
      <div className={styles.prevtbl}>
        <table>
          <thead>
            <tr>
              {f.cols.map((c, ci) => (
                <th key={ci} className={styles['r_' + (c.on ? c.role : 'ignore')]}>
                  {c.role === 'metric' && c.on ? c.name : c.h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {f.rows.slice(0, 6).map((r, ri) => (
              <tr key={ri}>
                {f.cols.map((_, ci) => (
                  <td key={ci}>{r[ci] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// Tiny built-in sample exports so the wizard can be tried without a file.
const SAMPLES: Record<ImportKind, Array<{ name: string; text: string }>> = {
  gsc: [
    {
      name: 'Dates.csv',
      text:
        'Date,Clicks,Impressions,CTR,Position\n' +
        Array.from({ length: 14 }, (_, i) => {
          const d = `2026-10-${String(i + 1).padStart(2, '0')}`
          return `${d},${320 + i * 24 + (i % 3) * 40},${9000 + i * 300},${(2.8 + (i % 5) * 0.2).toFixed(2)}%,${(7.4 + (i % 4) * 0.3).toFixed(1)}`
        }).join('\n'),
    },
    {
      name: 'Queries.csv',
      text: 'Top queries,Clicks,Impressions\nbest running shoes,3240,98400\ntrail running shoes,2110,74200\nmarathon plan,1680,52900\nhiking boots,1240,41800',
    },
    {
      name: 'Devices.csv',
      text: 'Device,Clicks,Impressions\nMOBILE,7820,241000\nDESKTOP,4310,138600\nTABLET,690,22400',
    },
  ],
  ga4: [
    {
      name: 'Traffic_acquisition.csv',
      text:
        '# GA4 sample export\n\nDate,Sessions,Active users,Views,Engagement rate\n' +
        Array.from({ length: 14 }, (_, i) => {
          const d = `2026-10-${String(i + 1).padStart(2, '0')}`
          const s = 1400 + i * 90
          return `${d},${s},${Math.round(s * 0.73)},${s * 3},${(0.55 + (i % 5) * 0.02).toFixed(4)}`
        }).join('\n'),
    },
    {
      name: 'Channels.csv',
      text: 'Session default channel group,Sessions,Views\nOrganic Search,18420,61200\nDirect,12240,39800\nReferral,6180,20100\nOrganic Social,4920,15600',
    },
  ],
  csv: [
    {
      name: 'sales.csv',
      text:
        'Date,Revenue,Orders\n' +
        Array.from({ length: 14 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')},${1200 + i * 80},${30 + i}`).join('\n'),
    },
  ],
}
