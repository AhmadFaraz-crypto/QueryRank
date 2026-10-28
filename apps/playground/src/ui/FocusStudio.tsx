import { useEffect, useReducer, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BLOCK_BGS,
  METRIC_LIB,
  RANGES,
  SERIES,
  badge,
  blockData,
  draw,
  fmt,
  rangeName,
  styleBlock,
  typeName,
  vizSvg,
  TYPES,
  type BlockConfig,
  type BlockMetric,
} from './viz/engine'
import styles from './FocusStudio.module.scss'

interface FocusStudioProps {
  block: BlockConfig
  allBlocks: BlockConfig[]
  /** Active theme CSS variables, so the preview matches the dashboard. */
  vars: Record<string, string>
  onSave: (cfg: BlockConfig) => void
  onPersist?: (cfg: BlockConfig) => void
  onClose: () => void
  onSwitch: (id: string) => void
  onToast: (message: string) => void
}

const clone = (c: BlockConfig) => JSON.parse(JSON.stringify(c)) as BlockConfig
const snap = (c: BlockConfig) => JSON.stringify(c)

/* undo/redo editor state */
function useBlockEditor(block: BlockConfig) {
  const originalRef = useRef(snap(block))
  const histRef = useRef<{ list: string[]; idx: number }>({ list: [snap(block)], idx: 0 })
  const [cfg, setCfg] = useState<BlockConfig>(() => clone(block))
  const [, force] = useReducer((x: number) => x + 1, 0)

  useEffect(() => {
    originalRef.current = snap(block)
    histRef.current = { list: [originalRef.current], idx: 0 }
    setCfg(clone(block))
  }, [block])

  const push = (s: string) => {
    const h = histRef.current
    h.list = h.list.slice(0, h.idx + 1)
    h.list.push(s)
    h.idx = h.list.length - 1
  }
  const mutate = (fn: (c: BlockConfig) => void, commit = true) => {
    const next = clone(cfg)
    fn(next)
    if (commit) push(snap(next))
    setCfg(next)
  }
  const commit = () => {
    const s = snap(cfg)
    if (s !== histRef.current.list[histRef.current.idx]) {
      push(s)
      force()
    }
  }
  const undo = () => {
    const h = histRef.current
    if (h.idx > 0) {
      h.idx--
      setCfg(JSON.parse(h.list[h.idx]))
      force()
    }
  }
  const redo = () => {
    const h = histRef.current
    if (h.idx < h.list.length - 1) {
      h.idx++
      setCfg(JSON.parse(h.list[h.idx]))
      force()
    }
  }
  const reset = () => {
    push(originalRef.current)
    setCfg(JSON.parse(originalRef.current))
  }
  return {
    cfg,
    mutate,
    commit,
    undo,
    redo,
    reset,
    dirty: snap(cfg) !== originalRef.current,
    canUndo: histRef.current.idx > 0,
    canRedo: histRef.current.idx < histRef.current.list.length - 1,
  }
}

const BEST: Record<string, string[]> = {
  series: ['line', 'bar', 'number'],
  cats: ['hbar', 'pie', 'table'],
  target: ['gauge', 'progress', 'number'],
}
const DISPLAY_OPTS: Array<{ key: keyof BlockConfig; label: string; types: string[] }> = [
  { key: 'legend', label: 'Legend', types: ['line', 'pie', 'radial', 'bubble'] },
  { key: 'grid', label: 'Gridlines', types: ['line', 'bar'] },
  { key: 'labels', label: 'Value labels', types: ['line', 'bar', 'hbar'] },
  { key: 'smooth', label: 'Smooth lines', types: ['line'] },
  { key: 'rounded', label: 'Rounded bars', types: ['bar', 'hbar'] },
  { key: 'gradText', label: 'Gradient headline', types: ['number'] },
]
const BREAKDOWNS: Array<[string, string]> = [
  ['', 'None'], ['ITEM', 'Item'], ['CATEGORY', 'Category'], ['CHANNEL', 'Channel'], ['QUERY', 'Query'], ['PAGE', 'Page'], ['DEVICE', 'Device'],
]
const COMPARES: Array<[string, string]> = [['Previous', 'Previous period'], ['Goal', 'Goal'], ['None', 'None']]
const SIZES: Array<[number, string]> = [[3, 'S'], [4, 'M'], [6, 'L'], [12, 'Wide']]

function Icon({ svg, className }: { svg: string; className?: string }) {
  return <span className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
}

export function FocusStudio({ block, allBlocks, vars, onSave, onPersist, onClose, onSwitch, onToast }: FocusStudioProps) {
  const ed = useBlockEditor(block)
  const { cfg, mutate, commit, undo, redo, reset, dirty, canUndo, canRedo } = ed
  const [mActive, setMActive] = useState(0)
  const [dataOpen, setDataOpen] = useState(false)
  const [switchOpen, setSwitchOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pick, setPick] = useState('')
  const stripRef = useRef<HTMLDivElement>(null)

  const D = blockData(cfg)
  const seriesPair: [string, string] = cfg.custom ?? (cfg.series != null ? SERIES[cfg.series] : ['#FF6B5B', '#8EA2FF'])

  const tryBack = () => {
    if (dirty) setConfirmOpen(true)
    else onClose()
  }

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|SELECT|TEXTAREA/.test((document.activeElement?.tagName as string) || '')
      if (e.key === 'Escape') { e.preventDefault(); tryBack() }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo() }
      if (!typing && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault()
        const i = TYPES.findIndex((t) => t[0] === cfg.type)
        const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + TYPES.length) % TYPES.length
        mutate((c) => (c.type = TYPES[n][0]))
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const doSwitch = (id: string) => {
    if (id === cfg.id) return
    if (dirty) { onPersist?.(cfg); onToast('Previous block saved') }
    onSwitch(id)
    setSwitchOpen(false)
  }

  const addMetric = (name: string, source: string) => {
    mutate((c) => {
      c.metrics.push({ name, label: name, source, breakdown: c.metrics[0]?.breakdown || '', compare: 'Previous', small: true, filters: [] })
    })
    setMActive(cfg.metrics.length)
    setPick('')
    onToast(`Added ${name}`)
  }

  const pickRows = (() => {
    const q = pick.trim().toLowerCase()
    const seen = new Set<string>()
    return METRIC_LIB.filter((m) => {
      const k = m.n + '|' + m.src
      if (seen.has(k)) return false
      seen.add(k)
      return !q || m.n.toLowerCase().includes(q) || m.s.toLowerCase().includes(q)
    }).slice(0, q ? 40 : 8)
  })()

  const summary = `${typeName(cfg.type)} · ${cfg.metrics.map((m) => m.label).join(', ') || 'no metrics'} · ${rangeName(cfg.date)}`
  const kind = !D ? null : D.hasBreakdown ? 'cats' : D.p.avg ? 'target' : 'series'

  return createPortal(
    <div className={`${styles.studio} ${dirty ? styles.dirty : ''}`} role="dialog" aria-modal="true" aria-label="Block studio" onMouseDown={(e) => { if (e.target === e.currentTarget) tryBack() }}>
      <div className={styles.win}>
        {/* HEADER */}
        <header className={styles.head}>
          <button className={styles.back} type="button" onClick={tryBack}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
            Back
          </button>
          <span className={styles.sep} />
          <Icon className={styles.ico} svg={vizSvg(cfg.type)} />
          <input
            className={styles.title}
            aria-label="Block title"
            placeholder="Untitled block"
            value={cfg.title}
            onChange={(e) => mutate((c) => (c.title = e.target.value), false)}
            onBlur={commit}
          />
          <div className={`${styles.switch} ${switchOpen ? styles.switchOpen : ''}`}>
            <button type="button" title="Switch to another block" onClick={(e) => { e.stopPropagation(); setSwitchOpen((o) => !o) }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {switchOpen ? (
              <div className={styles.menu}>
                <div className={styles.mh}>Jump to block</div>
                {allBlocks.map((b) => (
                  <button key={b.id} type="button" className={b.id === cfg.id ? styles.on : ''} onClick={() => doSwitch(b.id)}>
                    <Icon svg={vizSvg(b.type)} />
                    {b.title || 'Untitled'}
                    <small>{typeName(b.type)}</small>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <span className={styles.live}>
            <i />
            <b>{summary}</b>
          </span>
          <div className={styles.actions}>
            <span className={styles.dirtyDot} title="Unsaved changes" />
            <button className={styles.iconBtn} type="button" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 010 10h-3" /></svg>
            </button>
            <button className={styles.iconBtn} type="button" title="Redo" disabled={!canRedo} onClick={redo}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 14l5-5-5-5" /><path d="M20 9H9a5 5 0 000 10h3" /></svg>
            </button>
            <button className={`${styles.btn} ${styles.btnGhost}`} type="button" onClick={() => { reset(); onToast('Block reset') }}>Reset</button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={() => onSave(cfg)}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
              Save
            </button>
          </div>
        </header>

        {confirmOpen ? (
          <div className={styles.confirm}>
            You have unsaved changes.
            <button className={styles.keep} type="button" onClick={() => setConfirmOpen(false)}>Keep editing</button>
            <button className={styles.discard} type="button" onClick={() => { onClose(); onToast('Changes discarded') }}>Discard</button>
          </div>
        ) : null}

        <div className={styles.body}>
          {/* LEFT — DATA */}
          <aside className={`${styles.col} ${styles.left}`}>
            <div className={styles.h}><span className={styles.n}>1</span>Time range</div>
            <div className={styles.chips}>
              {RANGES.map(([v, n]) => (
                <button key={v} type="button" className={`${styles.chip} ${cfg.date === v ? styles.on : ''}`} onClick={() => mutate((c) => (c.date = v))}>{n}</button>
              ))}
            </div>

            <div className={styles.h}><span className={styles.n}>2</span>Metrics<span className={styles.r}>{cfg.metrics.length ? `${cfg.metrics.length} added` : ''}</span></div>
            {cfg.metrics.length === 0 ? (
              <div className={styles.empty}><b>No metrics yet</b>Search below to add one.</div>
            ) : (
              cfg.metrics.map((m, i) => (
                <MetricCard
                  key={i}
                  metric={m}
                  index={i}
                  active={i === mActive}
                  value={D ? fmt(D.ms[i].total, D.ms[i].unit, cfg, true) : '—'}
                  dotColor={i === 0 ? `linear-gradient(180deg,${seriesPair[0]},${seriesPair[1]})` : `var(--c${(i % 6) + 1})`}
                  onFocus={() => setMActive(mActive === i ? -1 : i)}
                  onRemove={() => { mutate((c) => c.metrics.splice(i, 1)); setMActive(0) }}
                  onPatch={(fn, c = true) => mutate((cf) => fn(cf.metrics[i]), c)}
                  onCommit={commit}
                />
              ))
            )}

            <div className={styles.pickerBox}>
              <label className={styles.search}>
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
                <input placeholder="Add a metric…" value={pick} onChange={(e) => setPick(e.target.value)} />
              </label>
              <div className={styles.pickList}>
                {!pick ? <div className={styles.mhSmall}>Suggested</div> : null}
                {pickRows.length === 0 ? <div className={styles.noMatch}>No matches</div> : null}
                {pickRows.map((m) => {
                  const b = badge(m.src)
                  return (
                    <button key={m.n + m.src} type="button" onClick={() => addMetric(m.n, m.s)}>
                      <span className={styles.srcBadge} style={{ background: b.bg }}>{b.t}</span>
                      {m.n}
                      <small>{m.src}</small>
                    </button>
                  )
                })}
              </div>
            </div>
          </aside>

          {/* CENTER — STAGE */}
          <section className={styles.stage}>
            <div className={styles.bar}>
              <span className={styles.lbl2}>Size on dashboard</span>
              <div className={styles.miniSeg}>
                {SIZES.map(([n, l]) => (
                  <button key={n} type="button" className={cfg.size === n ? styles.on : ''} onClick={() => mutate((c) => (c.size = n))}>
                    <span className={styles.gl}>{[0, 1, 2, 3].map((k) => <i key={k} className={k < n / 3 ? styles.fill : ''} />)}</span>
                    {l}
                  </button>
                ))}
              </div>
              <span className={styles.sp} />
              <div className={styles.miniSeg}>
                <button type="button" className={dataOpen ? styles.on : ''} onClick={() => setDataOpen((o) => !o)}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16" /></svg>
                  Data
                </button>
              </div>
            </div>

            <div className={styles.preview}>
              <PreviewCard cfg={cfg} vars={vars} />
            </div>

            {dataOpen && D ? (
              <div className={styles.data}>
                <table>
                  <thead><tr><th>{D.hasBreakdown ? 'Segment' : 'Period'}</th><th>{D.p.name}</th></tr></thead>
                  <tbody>{D.cats.map(([n, v]: [string, number]) => <tr key={n}><td>{n}</td><td>{fmt(v, D.p.unit, cfg)}</td></tr>)}</tbody>
                </table>
              </div>
            ) : null}
          </section>

          {/* RIGHT — STYLE */}
          <aside className={`${styles.col} ${styles.right}`}>
            <div className={styles.h}>Colour</div>
            <div className={styles.swRow}>
              <button type="button" className={`${styles.sw} ${styles.none} ${cfg.series == null && !cfg.custom ? styles.on : ''}`} title="Use theme colours" onClick={() => mutate((c) => { c.series = null; c.custom = null })} />
              {SERIES.map((p, i) => (
                <button key={i} type="button" className={`${styles.sw} ${cfg.series === i && !cfg.custom ? styles.on : ''}`} title={`${p[0]} → ${p[1]}`} style={{ background: `linear-gradient(135deg,${p[0]},${p[1]})` }} onClick={() => mutate((c) => { c.series = i; c.custom = null })} />
              ))}
            </div>
            <div className={styles.custGrad} title="Custom gradient">
              <label style={{ background: seriesPair[0] }}>
                <input type="color" value={seriesPair[0]} onChange={(e) => mutate((c) => { c.custom = [e.target.value, seriesPair[1]]; c.series = null }, false)} onBlur={commit} />
              </label>
              <span className={styles.gBar} style={{ background: `linear-gradient(90deg,${seriesPair[0]},${seriesPair[1]})` }} />
              <label style={{ background: seriesPair[1] }}>
                <input type="color" value={seriesPair[1]} onChange={(e) => mutate((c) => { c.custom = [seriesPair[0], e.target.value]; c.series = null }, false)} onBlur={commit} />
              </label>
            </div>

            <div className={styles.h}>Block background</div>
            <div className={styles.swRow}>
              {BLOCK_BGS.map((o, i) => (
                <button key={o.n} type="button" className={`${styles.sw} ${o.css ? '' : styles.none} ${(cfg.bg || 0) === i ? styles.on : ''}`} title={o.n} style={o.css ? { background: o.css } : undefined} onClick={() => mutate((c) => (c.bg = i))} />
              ))}
            </div>

            <div className={styles.h}>Display</div>
            {DISPLAY_OPTS.map((o) => {
              const na = !o.types.includes(cfg.type)
              return (
                <label key={o.key} className={`${styles.opt} ${na ? styles.na : ''}`} title={na ? `Not used by ${typeName(cfg.type)} charts` : ''}>
                  {o.label}
                  <input type="checkbox" checked={!!cfg[o.key]} onChange={(e) => mutate((c) => { (c as unknown as Record<string, unknown>)[o.key as string] = e.target.checked })} />
                  <span className={styles.tr} />
                </label>
              )
            })}

            <div className={styles.h}>Text size</div>
            <div className={styles.rangeRow}>
              A
              <input type="range" min={80} max={140} step={5} value={cfg.fz} onChange={(e) => mutate((c) => (c.fz = +e.target.value), false)} onMouseUp={commit} onKeyUp={commit} />
              <span style={{ fontSize: 15 }}>A</span>
              <b>{cfg.fz}%</b>
            </div>

            <div className={styles.h}>Numbers</div>
            <div className={styles.chips}>
              {[['full', '1,089.00'], ['compact', '1.1K'], ['round', '1,089']].map(([v, l]) => (
                <button key={v} type="button" className={`${styles.chip} ${cfg.fmt === v ? styles.on : ''}`} onClick={() => mutate((c) => (c.fmt = v))}>{l}</button>
              ))}
            </div>

            <div className={styles.h}>Sort</div>
            <div className={styles.chips}>
              {[['value-desc', 'Highest first'], ['value-asc', 'Lowest first'], ['name-asc', 'A → Z'], ['none', 'Original']].map(([v, l]) => (
                <button key={v} type="button" className={`${styles.chip} ${cfg.sort === v ? styles.on : ''}`} onClick={() => mutate((c) => (c.sort = v))}>{l}</button>
              ))}
            </div>
          </aside>
        </div>

        {/* STRIP */}
        <footer className={styles.strip}>
          <div className={styles.stripH}>
            <h4>Chart type</h4>
            <span>Each preview uses this block's real data · <kbd>←</kbd> <kbd>→</kbd> to switch</span>
            <div className={styles.nav}>
              <button type="button" aria-label="Scroll left" onClick={() => stripRef.current?.scrollBy({ left: -480, behavior: 'smooth' })}>‹</button>
              <button type="button" aria-label="Scroll right" onClick={() => stripRef.current?.scrollBy({ left: 480, behavior: 'smooth' })}>›</button>
            </div>
          </div>
          <div className={styles.stripRow} ref={stripRef}>
            {TYPES.map(([k, n], i) => (
              <ThumbCard key={k} cfg={cfg} vars={vars} type={k} name={n} index={i + 1} active={k === cfg.type} best={!!(kind && BEST[kind].includes(k))} onClick={() => mutate((c) => (c.type = k))} />
            ))}
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

/* ---------- preview + thumbnail cards (apply per-block styling imperatively) ---------- */

function PreviewCard({ cfg, vars }: { cfg: BlockConfig; vars: Record<string, string> }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (boxRef.current) for (const [k, v] of Object.entries(vars)) boxRef.current.style.setProperty(k, v)
    if (cardRef.current) styleBlock(cardRef.current, cfg)
    if (hostRef.current) draw(hostRef.current, cfg.type, cfg, { W: cfg.size * 82 })
  }, [cfg, vars])
  const width = Math.min(1040, cfg.size * 86 + 52)
  return (
    <div className={`${styles.canvas} dash-vars`} ref={boxRef} style={{ background: vars['--dash-bg'] }}>
      <div className={`card ${cfg.gradText ? 'grad-text' : ''}`} ref={cardRef} style={{ width }}>
        <div className="c-head">
          <span className="c-title" style={cfg.title ? { fontSize: 16 } : { fontSize: 16, visibility: 'hidden' }}>{cfg.title || '.'}</span>
          <span className="period">{rangeName(cfg.date)}</span>
        </div>
        <div className="viz-host" ref={hostRef} />
      </div>
    </div>
  )
}

function ThumbCard({ cfg, vars, type, name, index, active, best, onClick }: { cfg: BlockConfig; vars: Record<string, string>; type: string; name: string; index: number; active: boolean; best: boolean; onClick: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (boxRef.current) for (const [k, v] of Object.entries(vars)) boxRef.current.style.setProperty(k, v)
    if (cardRef.current) styleBlock(cardRef.current, cfg)
    if (hostRef.current) draw(hostRef.current, type, cfg, { thumb: true, W: 200 })
  }, [cfg, type, vars])
  return (
    <button type="button" className={`${styles.tCard} ${active ? styles.on : ''}`} onClick={onClick}>
      {best ? <span className={styles.best}>Best fit</span> : null}
      <div className={`${styles.tThumb} dash-vars`} ref={boxRef} style={{ background: vars['--dash-bg'] }}>
        <div className="card" ref={cardRef} style={{ padding: 8, boxShadow: 'none', width: '100%' }}>
          <div className={styles.thHost} ref={hostRef} />
        </div>
      </div>
      <div className={styles.tn}>{name}<small>{index}</small></div>
    </button>
  )
}

/* ---------- metric card ---------- */

function MetricCard({ metric, index, active, value, dotColor, onFocus, onRemove, onPatch, onCommit }: {
  metric: BlockMetric
  index: number
  active: boolean
  value: string
  dotColor: string
  onFocus: () => void
  onRemove: () => void
  onPatch: (fn: (m: BlockMetric) => void, commit?: boolean) => void
  onCommit: () => void
}) {
  void index
  return (
    <div className={`${styles.mCard} ${active ? styles.mActive : ''}`}>
      <div className={styles.mTop} role="button" tabIndex={0} onClick={onFocus} onKeyDown={(e) => { if (e.key === 'Enter') onFocus() }}>
        <span className={styles.mDot} style={{ background: dotColor }} />
        <div className={styles.mInfo}>
          <div className={styles.nm}>{metric.label}</div>
          <div className={styles.sr}>{metric.source}</div>
        </div>
        <span className={styles.val}>{value}</span>
        <button className={styles.x} type="button" title="Remove metric" onClick={(e) => { e.stopPropagation(); onRemove() }}>×</button>
      </div>
      {active ? (
        <div className={styles.mBody}>
          <div className={styles.sub}>Label</div>
          <input className={styles.fld} value={metric.label} onChange={(e) => onPatch((m) => (m.label = e.target.value), false)} onBlur={onCommit} />
          <div className={styles.sub}>Break down by</div>
          <div className={styles.chips}>
            {BREAKDOWNS.map(([v, n]) => (
              <button key={v} type="button" className={`${styles.chip} ${metric.breakdown === v ? styles.on : ''}`} onClick={() => onPatch((m) => (m.breakdown = v))}>{n}</button>
            ))}
          </div>
          <div className={styles.sub}>Compare with</div>
          <div className={styles.chips}>
            {COMPARES.map(([v, n]) => (
              <button key={v} type="button" className={`${styles.chip} ${metric.compare === v ? styles.on : ''}`} onClick={() => onPatch((m) => (m.compare = v))}>{n}</button>
            ))}
          </div>
          <label className={`${styles.opt} ${styles.optTight}`}>
            Mini trend chart
            <input type="checkbox" checked={metric.small !== false} onChange={(e) => onPatch((m) => (m.small = e.target.checked))} />
            <span className={styles.tr} />
          </label>
        </div>
      ) : null}
    </div>
  )
}
