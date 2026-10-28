import { useState } from 'react'
import { LiveSearchConsole } from './LiveSearchConsole'
import { LiveGa4 } from './LiveGa4'
import { ImportWizard } from './ImportWizard'
import styles from './DataSources.module.scss'

/**
 * Data sources screen. Two paths to real data: connect your own Google account
 * (live, OAuth) or import a CSV export (no account needed). Both keep the data
 * on your server.
 */
export function DataSources() {
  const [importing, setImporting] = useState(false)

  return (
    <div className={styles.screen}>
      <div className={styles.wrap}>
        <div className={styles.head}>
          <div>
            <h1>Data sources</h1>
            <p>
              Connect your own accounts and QueryRank pulls live data straight into your
              dashboards — nothing is stored off your server.
            </p>
          </div>
        </div>

        <LiveSearchConsole />
        <LiveGa4 />

        {/* The no-account path: a file import, set apart from the live connects
            by a lighter, upload-style treatment. */}
        <button type="button" className={styles.importCard} onClick={() => setImporting(true)}>
          <span className={styles.importIc} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 16V4m0 0L8 8m4-4l4 4" />
              <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
            </svg>
          </span>
          <span className={styles.importTx}>
            <span className={styles.importKicker}>No account needed</span>
            <b>Import a CSV export</b>
            <span>
              Export from Search Console or GA4 and drop the file in — it's normalized into
              every template and never leaves your server.
            </span>
          </span>
          <span className={styles.importGo}>Import a file</span>
        </button>

        <p className={styles.note}>
          More integrations are on the way. Each one connects to your own account, so your
          data stays in your infrastructure.
        </p>
      </div>

      {importing ? <ImportWizard onClose={() => setImporting(false)} /> : null}
    </div>
  )
}
