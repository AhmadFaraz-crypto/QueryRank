import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DASH_TEMPLATES, dashboardView, type Dashboard } from './data/dashboards'
import { StaticDashboard } from './components/StaticDashboard'

/**
 * A chrome-less, auth-free page that renders one dashboard template — the target
 * the CLI's `render` command screenshots headlessly. Controlled by query params:
 *   /render?template=<id>&theme=<name>&width=<px>
 * It sets `data-render-ready` on <body> once drawn so a headless browser knows
 * when to capture.
 */
export function RenderPage() {
  const [params] = useSearchParams()
  const rootRef = useRef<HTMLDivElement>(null)

  const id = params.get('template') ?? DASH_TEMPLATES[0].id
  const themeName = params.get('theme')
  const width = Math.max(480, Number(params.get('width')) || 1200)

  const base = DASH_TEMPLATES.find((t) => t.id === id) ?? DASH_TEMPLATES[0]
  const dash: Dashboard = themeName ? { ...base, theme: themeName, themeState: null } : base
  const { vars, bg } = dashboardView(dash)

  useEffect(() => {
    document.body.removeAttribute('data-render-ready')
    // Let the two-pass chart redraw settle, then signal "ready" to capture.
    const t = setTimeout(() => document.body.setAttribute('data-render-ready', '1'), 450)
    return () => clearTimeout(t)
  }, [id, themeName, width])

  return (
    <div
      style={{
        display: 'inline-block',
        padding: 28,
        background: '#ffffff',
      }}
    >
      <div style={{ width, borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 40px rgba(16,24,40,.12)' }}>
        <StaticDashboard dash={dash} vars={vars} bg={bg} rootRef={rootRef} fluid />
      </div>
    </div>
  )
}
