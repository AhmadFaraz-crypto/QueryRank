import { type ReactNode } from 'react'
import { DASH_TEMPLATES } from '../data/dashboards'
import { ScaledDash } from '../components/StaticDashboard'
import { presetBg, presetThemeVars } from '../viz/theme'
import styles from '../Auth.module.scss'

/**
 * The shared split layout for the auth pages (login / register / forgot):
 * a form column on the left and a product showcase on the right.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const showcase = DASH_TEMPLATES.find((t) => t.id === 'gsc') ?? DASH_TEMPLATES[0]

  return (
    <section className={styles.auth} aria-label="Account">
      <div className={styles.form}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <span className={styles.bm} aria-hidden="true">
              {/* Ascending rank bars + position node — the signature mark. */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
                <rect x="3" y="13" width="3.6" height="8" rx="1.3" opacity="0.55" />
                <rect x="9.2" y="9.5" width="3.6" height="11.5" rx="1.3" opacity="0.78" />
                <rect x="15.4" y="6" width="3.6" height="15" rx="1.3" />
                <circle cx="17.2" cy="3" r="1.7" />
              </svg>
            </span>
            <span>QueryRank</span>
          </div>
        </div>

        <div className={styles.mid}>
          <div className={styles.card}>{children}</div>
        </div>

        <div className={styles.foot}>
          <span>© 2026 QueryRank</span>
          <span>
            <a href="https://getqueryrank.com/privacy/" target="_blank" rel="noreferrer noopener">
              Privacy
            </a>
            <a href="https://getqueryrank.com/terms/" target="_blank" rel="noreferrer noopener">
              Terms
            </a>
            <a href="https://github.com/AhmadFaraz-crypto/QueryRank" target="_blank" rel="noreferrer noopener">
              Help
            </a>
          </span>
        </div>
      </div>

      <aside className={styles.show} aria-hidden="true">
        <span className={styles.kick}>
          <b />
          Live dashboards
        </span>
        <h2>
          Every metric that matters, <em>in one calm view.</em>
        </h2>
        <p>
          Connect your tools, start from a template and share a dashboard your whole team
          actually reads.
        </p>
        <div className={styles.stage}>
          <div className={styles.shot} style={{ background: presetBg('Clean') }}>
            <ScaledDash dash={showcase} vars={presetThemeVars('Clean')} bg={presetBg('Clean')} />
          </div>
          <div className={`${styles.float} ${styles.f1}`}>
            <span className={styles.ic} style={{ background: 'var(--accent-grad)' }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M3 17l6-6 4 4 8-8" />
                <path d="M15 7h6v6" />
              </svg>
            </span>
            <span>
              <b>+18.4%</b>
              <small>Revenue this month</small>
            </span>
          </div>
          <div className={`${styles.float} ${styles.f2}`}>
            <span className={styles.ic} style={{ background: 'linear-gradient(135deg,#1f2937,#6b7280)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 7h16M4 12h16M4 17h10" />
              </svg>
            </span>
            <span>
              <b>Top query</b>
              <small>“fitness tracker” — 3,869 clicks</small>
            </span>
          </div>
        </div>
        <div className={styles.feat}>
          <span>
            <Check /> Your data, your server
          </span>
          <span>
            <Check /> Live GSC &amp; GA4
          </span>
          <span>
            <Check /> Import a CSV
          </span>
        </div>
      </aside>
    </section>
  )
}

// Shared sign-in-with-Google (real OAuth) and a notice hook for callback errors.
export function useGoogleSignIn() {
  return () => {
    window.location.href = '/api/auth/google'
  }
}

/* ---------- small icons reused across the auth pages ---------- */
export const MailIc = () => (
  <svg className={styles.leadIc} width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
)
export const LockIc = () => (
  <svg className={styles.leadIc} width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 018 0v4" />
  </svg>
)
export const UserIc = () => (
  <svg className={styles.leadIc} width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20a8 8 0 0116 0" />
  </svg>
)
export const EyeIc = ({ shown }: { shown: boolean }) =>
  shown ? (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
      <path d="M9.4 5.1A9.9 9.9 0 0112 5c6 0 10 7 10 7a16 16 0 01-3 3.6M6 6.6A16 16 0 002 12s4 7 10 7a9.6 9.6 0 004.5-1.1" />
    </svg>
  ) : (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
export const ArrowIc = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)
export const Check = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
    <path d="M5 13l4 4L19 7" />
  </svg>
)

export const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
