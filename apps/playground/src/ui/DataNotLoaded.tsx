import styles from './DataNotLoaded.module.scss'

/**
 * Shown instead of dummy data when the backend can't be reached to load the
 * user's real data. `fullscreen` centers it on a blank page (the route guard's
 * server-down case); inline it drops into a screen's content area (the gallery).
 */
export function DataNotLoaded({
  onRetry,
  fullscreen = false,
}: {
  onRetry: () => void
  fullscreen?: boolean
}) {
  return (
    <div className={`${styles.wrap}${fullscreen ? ` ${styles.full}` : ''}`}>
      <svg width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <ellipse cx="12" cy="6" rx="8" ry="3" />
        <path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
        <path d="M8.5 9.5l7 7M15.5 9.5l-7 7" />
      </svg>
      <h3>Your data couldn’t be loaded</h3>
      <p>We couldn’t reach the server to load your dashboards. Check that it’s running, then try again.</p>
      <button type="button" className={styles.retry} onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}
