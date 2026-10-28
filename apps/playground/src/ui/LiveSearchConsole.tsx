import { useCallback, useEffect, useState } from 'react'
import { useStore } from './AppStore'
import styles from './LiveSearchConsole.module.scss'

interface Conn {
  id: string
  provider: string
  label: string
  status: string
  lastSyncAt: string | null
}
interface Site {
  siteUrl: string
  permissionLevel: string
}
interface Row {
  keys?: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}
interface Overview {
  range: { startDate: string; endDate: string }
  totals: Row
  topQueries: Row[]
  series: Row[]
}

const api = (path: string, init?: RequestInit) =>
  fetch(path, { credentials: 'include', ...init })

const int = (n: number) => Math.round(n).toLocaleString('en-US')
const pct = (n: number) => `${(n * 100).toFixed(1)}%`
const pos = (n: number) => n.toFixed(1)

function Sparkline({ series }: { series: Row[] }) {
  const vals = series.map((r) => r.clicks)
  if (vals.length < 2) return null
  const max = Math.max(...vals, 1)
  const w = 520
  const h = 48
  const step = w / (vals.length - 1)
  const pts = vals.map(
    (v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`,
  )
  return (
    <svg className={styles.spark} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
      />
    </svg>
  )
}

export function LiveSearchConsole() {
  const { refreshLiveData, selectLiveSource } = useStore()
  const [conn, setConn] = useState<Conn | null>(null)
  const [sites, setSites] = useState<Site[]>([])
  const [site, setSite] = useState('')
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadConnections = useCallback(async () => {
    try {
      const res = await api('/api/connections')
      if (!res.ok) {
        setConn(null)
        return
      }
      const list = (await res.json()) as Conn[]
      setConn(list.find((c) => c.provider === 'gsc') ?? null)
    } catch {
      setConn(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('connect') === 'error') {
      setError('Couldn’t connect Search Console. Please try again.')
    }
    void loadConnections()
  }, [loadConnections])

  // When a connection appears, sync live data into the dashboards too.
  useEffect(() => {
    if (conn) void refreshLiveData()
  }, [conn, refreshLiveData])

  // Load this connection's properties once connected.
  useEffect(() => {
    if (!conn) return
    let active = true
    setError('')
    api(`/api/connections/${conn.id}/sites`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((list: Site[]) => {
        if (!active) return
        setSites(list)
        setSite((s) => s || list[0]?.siteUrl || '')
        if (list.length === 0)
          setError('No Search Console properties found for this account.')
      })
      .catch(() => active && setError('Couldn’t load properties. Try reconnecting.'))
    return () => {
      active = false
    }
  }, [conn])

  // Fetch real metrics whenever the selected property changes.
  useEffect(() => {
    if (!conn || !site) return
    let active = true
    setBusy(true)
    setError('')
    api(`/api/connections/${conn.id}/overview?site=${encodeURIComponent(site)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Overview) => active && setData(d))
      .catch(() => active && setError('Couldn’t load data for this property.'))
      .finally(() => active && setBusy(false))
    return () => {
      active = false
    }
  }, [conn, site])

  const connect = () => {
    window.location.href = '/api/connections/google/authorize'
  }
  const disconnect = async () => {
    if (!conn) return
    await api(`/api/connections/${conn.id}`, { method: 'DELETE' })
    setConn(null)
    setSites([])
    setSite('')
    setData(null)
    void refreshLiveData() // revert dashboards to dummy data
  }

  if (loading) return null

  if (!conn) {
    return (
      <div className={styles.panel}>
        <div className={styles.cta}>
          <div>
            <div className={styles.kicker}>Not connected</div>
            <h2>Connect Google Search Console</h2>
            <p>
              Authorize your own Google account and QueryRank pulls real clicks,
              impressions, CTR and position straight from the Search Console API — nothing
              is stored off your server.
            </p>
          </div>
          <button type="button" className={styles.connectBtn} onClick={connect}>
            <span className={styles.g}>G</span>Connect Search Console
          </button>
        </div>
      </div>
    )
  }

  const t = data?.totals
  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.title}>
          <span className={styles.liveDot} />
          <h2>Google Search Console</h2>
          <span className={styles.badge}>Live</span>
        </div>
        <div className={styles.controls}>
          {sites.length > 0 && (
            <select
              value={site}
              onChange={(e) => {
                setSite(e.target.value)
                // Keep the dashboards in sync with the site shown here.
                selectLiveSource('gsc', e.target.value)
              }}
            >
              {sites.map((s) => (
                <option key={s.siteUrl} value={s.siteUrl}>
                  {s.siteUrl}
                </option>
              ))}
            </select>
          )}
          <button type="button" className={styles.ghost} onClick={disconnect}>
            Disconnect
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {t && (
        <>
          <div className={styles.stats}>
            <Stat label="Clicks" value={int(t.clicks)} />
            <Stat label="Impressions" value={int(t.impressions)} />
            <Stat label="Average CTR" value={pct(t.ctr)} />
            <Stat label="Average position" value={pos(t.position)} />
          </div>
          {data && <Sparkline series={data.series} />}
          <div className={styles.rangeNote}>
            {busy
              ? 'Refreshing…'
              : `Last 28 days · ${data?.range.startDate} → ${data?.range.endDate}`}
          </div>
          {data && data.topQueries.length > 0 && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Top query</th>
                  <th>Clicks</th>
                  <th>Impressions</th>
                  <th>CTR</th>
                  <th>Position</th>
                </tr>
              </thead>
              <tbody>
                {data.topQueries.map((r) => (
                  <tr key={r.keys?.[0]}>
                    <td className={styles.q}>{r.keys?.[0]}</td>
                    <td>{int(r.clicks)}</td>
                    <td>{int(r.impressions)}</td>
                    <td>{pct(r.ctr)}</td>
                    <td>{pos(r.position)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statVal}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  )
}
