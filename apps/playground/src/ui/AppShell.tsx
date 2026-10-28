import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useStore } from './AppStore'
import { ErrorBoundary } from './ErrorBoundary'
import styles from './AppShell.module.scss'

interface RailItem {
  to: string
  tip: string
  paths: string
}

const RAIL: RailItem[] = [
  {
    to: '/dashboards',
    tip: 'Dashboards',
    paths:
      '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/>',
  },
  {
    to: '/data',
    tip: 'Data sources',
    paths:
      '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  },
]

function initials(n: string) {
  return (
    n
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || 'U'
  )
}

/** Persistent app chrome: the left icon rail + the active screen. */
function Shell() {
  const { user, signOut } = useStore()
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  // The designer is a focused full-screen workspace — hide the app nav there
  // (it has its own breadcrumb + close to exit).
  const fullscreen = location.pathname.startsWith('/designer')

  useEffect(() => {
    if (!menu) return
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [menu])

  return (
    <div className={`${styles.app}${fullscreen ? ` ${styles.full}` : ''}`}>
      {!fullscreen && (
      <nav className={styles.sidebar} aria-label="Main">
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            {/* Ascending rank bars with a position node on the lead bar —
                "climbing to #1". The signature mark. */}
            <svg width="19" height="19" viewBox="0 0 24 24" fill="#fff">
              <rect x="3" y="13" width="3.6" height="8" rx="1.3" opacity="0.55" />
              <rect x="9.2" y="9.5" width="3.6" height="11.5" rx="1.3" opacity="0.78" />
              <rect x="15.4" y="6" width="3.6" height="15" rx="1.3" />
              <circle cx="17.2" cy="3" r="1.7" />
            </svg>
          </span>
          <span className={styles.wordmark}>QueryRank</span>
        </div>

        <div className={styles.nav}>
          {RAIL.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
            >
              <svg
                width="19"
                height="19"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: item.paths }}
              />
              <span>{item.tip}</span>
            </NavLink>
          ))}
        </div>

        <div className={styles.foot}>
          <button
            type="button"
            className={styles.user}
            aria-label="Account menu"
            onClick={(e) => {
              e.stopPropagation()
              setMenu((v) => !v)
            }}
          >
            <span className={styles.avatar}>{initials(user.name)}</span>
            <span className={styles.userInfo}>
              <b>{user.name || 'User'}</b>
              <small>{user.email || 'you@company.com'}</small>
            </span>
            <svg
              className={styles.chev}
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
            </svg>
          </button>

          <div ref={menuRef} className={`${styles.acct} ${menu ? styles.acctOn : ''}`}>
            <button type="button" onClick={() => setMenu(false)}>
              Brand kit
            </button>
            <button type="button" onClick={() => setMenu(false)}>
              Account settings
            </button>
            <button type="button" onClick={() => setMenu(false)}>
              Switch workspace
            </button>
            <button
              type="button"
              className={styles.out}
              onClick={() => {
                setMenu(false)
                signOut()
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>
      )}

      <ErrorBoundary key={location.pathname}>
        <Outlet />
      </ErrorBoundary>
    </div>
  )
}

export function AppShell() {
  return <Shell />
}
