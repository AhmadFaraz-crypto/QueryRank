import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Dashboard } from './data/dashboards'
import { useStore } from './AppStore'
import { StaticDashboard } from './components/StaticDashboard'
import { badge, dashSources } from './viz/engine'
import { THEMES, presetBg, presetThemeVars, themeBg, themeVars } from './viz/theme'
import styles from './PreviewModal.module.scss'

interface PreviewModalProps {
  dash: Dashboard
  list: Dashboard[]
  isMine: boolean
  onClose: () => void
  onEdit: (dash: Dashboard, isMine: boolean, themeName: string) => void
}

export function PreviewModal({
  dash: initial,
  list,
  isMine,
  onClose,
  onEdit,
}: PreviewModalProps) {
  const startIdx = Math.max(
    0,
    list.findIndex((d) => d.id === initial.id),
  )
  const [idx, setIdx] = useState(startIdx)
  const [themeName, setThemeName] = useState(initial.theme)
  // Whether the viewer picked a preset in this modal (overriding the dashboard's
  // own saved/edited theme). Until then we render the dashboard's real theme.
  const [picked, setPicked] = useState(false)
  const dash = list[idx] ?? initial

  const step = (d: number) => {
    const n = (idx + d + list.length) % list.length
    setIdx(n)
    setThemeName(list[n].theme)
    setPicked(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const { liveState, activeDatasetId } = useStore()

  // Render the dashboard's own edited/saved theme by default; fall back to the
  // named preset, or whatever preset the viewer picks in the theme row.
  const custom = !picked && dash.themeState ? dash.themeState : null
  const vars = custom ? themeVars(custom) : presetThemeVars(themeName)
  const bg = custom ? themeBg(custom) : presetBg(themeName)
  const sources = dashSources(dash.blocks)

  // Honest footer status based on what's actually feeding the charts: imported
  // dataset, live source(s), a failed fetch, or the synthetic sample preview.
  const liveKinds = sources
    .map((s) => (s === 'Google Search Console' ? 'gsc' : s === 'Google Analytics 4' ? 'ga4' : null))
    .filter((k): k is 'gsc' | 'ga4' => k !== null)
  const connectedKinds = liveKinds.filter((k) => liveState[k] && !liveState[k]?.error)
  const erroredKinds = liveKinds.filter((k) => liveState[k]?.error)
  const status: 'imported' | 'live' | 'error' | 'sample' = activeDatasetId
    ? 'imported'
    : liveKinds.length === 0
      ? 'sample'
      : erroredKinds.length > 0
        ? 'error'
        : connectedKinds.length === liveKinds.length
          ? 'live'
          : 'sample'
  const dataLabel = {
    imported: 'Imported data',
    live: 'Live data · updated just now',
    error: 'Data not loaded',
    sample: 'Sample data · preview',
  }[status]
  const connLabel = {
    imported: 'Using imported data',
    live: '✓ Connected',
    error: '⚠ Couldn’t reach source',
    sample: 'Not connected',
  }[status]
  const connColor = status === 'live' ? '#14897C' : status === 'error' ? '#C2412F' : '#8a8f98'

  // The dashboard renders fluid (its 12-column grid fills the modal width, so
  // cards stretch to fill with no wasted space), exactly like the reference.
  const dashRef = useRef<HTMLDivElement>(null)

  return createPortal(
    <div
      className={styles.pv}
      role="dialog"
      aria-modal="true"
      aria-label="Dashboard preview"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={styles.win}>
        <header className={styles.head}>
          <span className={styles.ico}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="8" height="8" rx="2" />
              <rect x="13" y="3" width="8" height="5" rx="2" />
              <rect x="13" y="10" width="8" height="11" rx="2" />
              <rect x="3" y="13" width="8" height="8" rx="2" />
            </svg>
          </span>
          <div className={styles.ttl}>
            <b>
              {dash.n}
              <em>{isMine ? 'My dashboard' : `${dash.cat} template`}</em>
            </b>
            <small>
              {dash.blocks.length} blocks · {sources.join(', ')}
            </small>
          </div>
          <div className={styles.themes}>
            <span>Theme</span>
            {THEMES.map((t) => (
              <button
                key={t.n}
                type="button"
                title={t.n}
                className={!custom && themeName === t.n ? styles.on : ''}
                style={{ background: presetBg(t.n) }}
                onClick={() => {
                  setThemeName(t.n)
                  setPicked(true)
                }}
              />
            ))}
          </div>
          <div className={styles.nav}>
            <button
              className={styles.iconBtn}
              type="button"
              title="Previous (←)"
              disabled={list.length < 2}
              onClick={() => step(-1)}
            >
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              className={styles.iconBtn}
              type="button"
              title="Next (→)"
              disabled={list.length < 2}
              onClick={() => step(1)}
            >
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            type="button"
            onClick={() => onEdit(dash, isMine, themeName)}
          >
            <svg
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M4 20h4L19 9l-4-4L4 16v4z" />
            </svg>
            Edit dashboard
          </button>
          <button
            className={styles.iconBtn}
            type="button"
            title="Close (Esc)"
            onClick={onClose}
          >
            <svg
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className={styles.body} style={{ background: bg }}>
          <StaticDashboard
            fluid
            compact
            interactive
            dash={dash}
            vars={vars}
            bg={bg}
            rootRef={dashRef}
          />
        </div>

        <footer className={styles.foot}>
          <span>{dataLabel}</span>
          <span className={styles.sp} />
          <span className={styles.srcs}>
            {liveKinds.length > 0 ? (
              <>
                <span style={{ color: connColor, fontWeight: 600 }}>{connLabel}</span>
                {' · '}
              </>
            ) : null}
            {sources.map((s) => {
              const b = badge(s)
              return (
                <span
                  key={s}
                  className={styles.srcBadge}
                  style={{ background: b.bg }}
                  title={s}
                >
                  {b.t}
                </span>
              )
            })}
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
