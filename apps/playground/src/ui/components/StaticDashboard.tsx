import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useStore } from '../AppStore'
import { dashSources, draw, rangeDays, rangeName, styleBlock } from '../viz/engine'
import { attachTooltips } from '../viz/tooltip'
import { DateRangeMenu } from './DateRangeMenu'
import { SourceMenu } from './SourceMenu'
import type { Dashboard } from '../data/dashboards'

interface StaticDashboardProps {
  dash: Dashboard
  vars: Record<string, string>
  bg: string
  rootRef: RefObject<HTMLDivElement | null>
  /** Fill the parent width (fluid grid) instead of the fixed 1140px canvas. */
  fluid?: boolean
  /** Tighter spacing + shorter charts so dense dashboards fit without scroll. */
  compact?: boolean
  /** Enable the per-card date-range dropdown (preview only, not thumbnails). */
  interactive?: boolean
}

/** A non-interactive dashboard rendered by the engine (for thumbnails/preview). */
export function StaticDashboard({
  dash,
  vars,
  bg,
  rootRef,
  fluid,
  compact,
  interactive,
}: StaticDashboardProps) {
  // Redraw when live source data is (re)loaded into the engine.
  const {
    liveVersion,
    liveState,
    selectLiveSource,
    refreshLiveData,
    ensureLiveRange,
    retryLiveRange,
    liveRangeStatus,
    activeDatasetId,
  } = useStore()
  // Which live source this dashboard pulls from (if that source is connected),
  // so the preview header can offer a site/property picker.
  const srcNames = dashSources(dash.blocks)
  const liveKind: 'gsc' | 'ga4' | null = srcNames.includes('Google Search Console')
    ? 'gsc'
    : srcNames.includes('Google Analytics 4')
      ? 'ga4'
      : null
  const livePicker = liveKind ? liveState[liveKind] : undefined
  // The live source a single block pulls from (its first metric's source).
  const blockKind = (b: Dashboard['blocks'][number]): 'gsc' | 'ga4' | null => {
    const s = b.metrics[0]?.source.split(',')[0].trim()
    return s === 'Google Search Console' ? 'gsc' : s === 'Google Analytics 4' ? 'ga4' : null
  }
  // A block is backed by a live source when the interactive preview is on, its
  // source is connected, and no imported dataset is overriding the registry.
  const liveCard = (b: Dashboard['blocks'][number]): 'gsc' | 'ga4' | null => {
    const k = blockKind(b)
    return interactive && k && liveState[k] && !activeDatasetId ? k : null
  }
  // Per-card date-range overrides (interactive preview): block id → range key.
  const [ranges, setRanges] = useState<Record<string, string>>({})
  const [labels, setLabels] = useState<Record<string, string>>({})
  // Last drawn height of each card, so the per-card loader keeps the exact same
  // size and the grid layout doesn't shift while live data reloads.
  const cardHeights = useRef<Record<string, number>>({})
  // Reset per-card ranges when switching to a different dashboard.
  useEffect(() => {
    setRanges({})
    setLabels({})
  }, [dash.id])
  // The range key a card should render with (its override, else its own default).
  const keyFor = (b: Dashboard['blocks'][number]) => ranges[b.id] ?? b.date

  // Make sure every live card's current window is fetched. Runs on mount and
  // whenever a card's range changes; ensureLiveRange dedupes already-loaded
  // windows, so switching a dropdown triggers exactly one fetch for that window.
  useEffect(() => {
    if (!interactive || activeDatasetId) return
    for (const b of dash.blocks) {
      const k = blockKind(b)
      if (k && liveState[k] && !liveState[k]?.error) ensureLiveRange(k, rangeDays(keyFor(b)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dash, ranges, liveState, interactive, activeDatasetId, ensureLiveRange])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
    const cards = root.querySelectorAll<HTMLDivElement>('[data-block]')
    const colW = fluid ? 100 : 82
    // Cards are matched to blocks by id (not position) — error/loader cards drop
    // out of the data-block set, so positional indexing would misalign.
    const blockOf = (card: HTMLDivElement) =>
      dash.blocks.find((b) => b.id === card.dataset.block)
    cards.forEach((card) => {
      const base = blockOf(card)
      if (!base) return
      const cfg = ranges[base.id] ? { ...base, date: ranges[base.id] } : base
      styleBlock(card, cfg)
      card.classList.toggle('grad-text', !!cfg.gradText)
      const host = card.querySelector<HTMLDivElement>('.viz-host')
      // Fluid cards are ~1 grid-col ≈ 100px wide; matching the engine width
      // avoids upscaling (which would re-inflate the compact chart heights).
      if (host) draw(host, cfg.type, cfg, { W: cfg.size * colW, compact })
    })
    // Second pass: a line/bar sharing a row with a taller card (e.g. a KPI stack
    // beside a row-spanning chart) is stretched by flex. Redraw it at the card's
    // real height so it fills with correct proportions instead of distorting.
    cards.forEach((card) => {
      const base = blockOf(card)
      if (
        !base ||
        (base.type !== 'line' &&
          base.type !== 'bar' &&
          base.type !== 'hbar' &&
          base.type !== 'bubble' &&
          base.type !== 'pie')
      )
        return
      const cfg = ranges[base.id] ? { ...base, date: ranges[base.id] } : base
      const host = card.querySelector<HTMLDivElement>('.viz-host')
      if (!host) return
      const w = host.clientWidth
      const h = host.clientHeight
      if (w > 0 && h > 0) {
        const W = cfg.size * colW
        draw(host, cfg.type, cfg, { W, compact, fillH: Math.round((h * W) / w) })
      }
    })
    // Remember each card's rendered height so the loader/error card can hold the
    // same size.
    cards.forEach((card) => {
      const id = card.dataset.block
      if (id && card.offsetHeight) cardHeights.current[id] = card.offsetHeight
    })
    return attachTooltips(root)
  }, [dash, vars, rootRef, liveVersion, compact, fluid, ranges])

  const setRange = (id: string, key: string, label: string) => {
    setRanges((r) => ({ ...r, [id]: key }))
    setLabels((l) => ({ ...l, [id]: label }))
  }

  const sub = dash.sub ?? `${dash.cat} · ${dashSources(dash.blocks).join(', ')}`

  // Re-pull live data for the currently shown windows. refreshLiveData clears
  // the per-range cache + re-resolves sources; the card effects then re-fetch.
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshLiveData()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div
      className={`dash-vars static-dash${compact ? ' compact' : ''}`}
      ref={rootRef}
      style={{ width: fluid ? '100%' : 1140, background: bg }}
    >
      <div className="d-head">
        <div>
          <h1>{dash.n}</h1>
          <p>{sub}</p>
        </div>
        <div className="d-filters">
          {interactive && liveKind && livePicker ? (
            <SourceMenu
              kind={liveKind}
              options={livePicker.options}
              selected={livePicker.selected}
              onChange={(v) => selectLiveSource(liveKind, v)}
            />
          ) : null}
        </div>
      </div>
      <div className="d-body" aria-live="polite">
        <div className="grid">
          {dash.blocks.map((b) => {
            const span = `w${b.size}${b.h && b.h > 1 ? ` h${b.h}` : ''}`
            // Per-card live state for its current date window.
            const k = liveCard(b)
            const days = rangeDays(keyFor(b))
            const listErr = k ? !!liveState[k]?.error : false
            const status = k && !listErr ? liveRangeStatus(k, days) : undefined
            const loading = !!k && !listErr && (status === undefined || status === 'loading')
            const errored = !!k && (listErr || status === 'error')

            // Live window still loading — themed progress bar, no stale numbers,
            // holding the card's last height so the grid doesn't shift.
            if (loading)
              return (
                <div
                  key={`ld-${b.id}`}
                  className={`card ${span} card-loading`}
                  style={{ height: cardHeights.current[b.id] }}
                  aria-hidden="true"
                >
                  <span className="load-track">
                    <span className="load-fill" />
                  </span>
                  <span className="load-label">Loading live data…</span>
                </div>
              )
            // Connected source whose data for this window couldn't be fetched —
            // "data not loaded" with a retry instead of dummy numbers.
            if (errored)
              return (
                <div
                  key={`er-${b.id}`}
                  className={`card ${span} card-error`}
                  style={{ height: cardHeights.current[b.id] }}
                  role="status"
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                    <ellipse cx="12" cy="6" rx="8" ry="3" />
                    <path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
                    <path d="M8.5 9.5l7 7M15.5 9.5l-7 7" />
                  </svg>
                  <span className="err-label">Data not loaded</span>
                  <button
                    type="button"
                    className="err-retry"
                    onClick={() => (listErr ? refreshLiveData() : k && retryLiveRange(k, days))}
                  >
                    Retry
                  </button>
                </div>
              )
            return (
              <div
                key={b.id}
                data-block={b.id}
                className={`card ${span}`}
                style={{ cursor: 'default' }}
              >
                <div className="c-head">
                  <span className="c-title">{b.title}</span>
                  {interactive ? (
                    <DateRangeMenu
                      value={keyFor(b)}
                      label={labels[b.id] ?? rangeName(b.date)}
                      onChange={(key, label) => setRange(b.id, key, label)}
                    />
                  ) : (
                    <span className="period">{rangeName(b.date)}</span>
                  )}
                </div>
                <div className="viz-host" />
              </div>
            )
          })}
        </div>
      </div>
      <div className="d-foot">
        <div className="l">
          <span className="brand-mark" />
          <span>QueryRank</span>
        </div>
        <div className="r">
          <span>Updated just now</span>
          {interactive ? (
            <button
              type="button"
              className="refresh"
              onClick={onRefresh}
              disabled={refreshing}
            >
              ↻ {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          ) : (
            <span className="refresh">↻ Refresh</span>
          )}
        </div>
      </div>
    </div>
  )
}

interface ScaledDashProps {
  dash: Dashboard
  vars: Record<string, string>
  bg: string
  /** Reports the scaled pixel height (for preview scroll sizing). */
  onHeight?: (h: number) => void
}

/** Fills its (positioned) parent and scales a StaticDashboard to fit the width. */
export function ScaledDash({ dash, vars, bg, onHeight }: ScaledDashProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const dashRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.3)

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const d = dashRef.current
    if (!wrap || !d) return
    const measure = () => {
      const s = wrap.clientWidth / 1140
      setScale(s)
      onHeight?.(d.offsetHeight * s)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    ro.observe(d)
    return () => ro.disconnect()
  }, [dash, vars, onHeight])

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transformOrigin: '0 0',
          transform: `scale(${scale})`,
          pointerEvents: 'none',
        }}
      >
        <StaticDashboard dash={dash} vars={vars} bg={bg} rootRef={dashRef} compact />
      </div>
    </div>
  )
}
