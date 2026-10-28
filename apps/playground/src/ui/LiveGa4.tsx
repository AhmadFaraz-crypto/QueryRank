import { useCallback, useEffect, useState } from 'react'
import { useStore } from './AppStore'
import styles from './LiveSearchConsole.module.scss'

interface Conn {
  id: string
  provider: string
  label: string
}
interface Property {
  property: string
  displayName: string
}
interface Overview {
  range: { startDate: string; endDate: string }
  totals: { sessions: number; users: number; pageViews: number; engagementRate: number }
}

const api = (path: string, init?: RequestInit) =>
  fetch(path, { credentials: 'include', ...init })
const int = (n: number) => Math.round(n).toLocaleString('en-US')
const pct = (n: number) => `${(n * 100).toFixed(1)}%`

export function LiveGa4() {
  const { refreshLiveData, selectLiveSource } = useStore()
  const [conn, setConn] = useState<Conn | null>(null)
  const [props, setProps] = useState<Property[]>([])
  const [property, setProperty] = useState('')
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
      setConn(list.find((c) => c.provider === 'ga4') ?? null)
    } catch {
      setConn(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConnections()
  }, [loadConnections])

  useEffect(() => {
    if (conn) void refreshLiveData()
  }, [conn, refreshLiveData])

  useEffect(() => {
    if (!conn) return
    let active = true
    setError('')
    api(`/api/connections/${conn.id}/properties`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((list: Property[]) => {
        if (!active) return
        setProps(list)
        setProperty((p) => p || list[0]?.property || '')
        if (list.length === 0) setError('No GA4 properties found for this account.')
      })
      .catch(() => active && setError('Couldn’t load properties. Try reconnecting.'))
    return () => {
      active = false
    }
  }, [conn])

  useEffect(() => {
    if (!conn || !property) return
    let active = true
    setBusy(true)
    setError('')
    api(`/api/connections/${conn.id}/overview?property=${encodeURIComponent(property)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Overview) => active && setData(d))
      .catch(() => active && setError('Couldn’t load data for this property.'))
      .finally(() => active && setBusy(false))
    return () => {
      active = false
    }
  }, [conn, property])

  const connect = () => {
    window.location.href = '/api/connections/google/authorize?provider=ga4'
  }
  const disconnect = async () => {
    if (!conn) return
    await api(`/api/connections/${conn.id}`, { method: 'DELETE' })
    setConn(null)
    setProps([])
    setProperty('')
    setData(null)
    void refreshLiveData()
  }

  if (loading) return null

  if (!conn) {
    return (
      <div className={styles.panel}>
        <div className={styles.cta}>
          <div>
            <div className={styles.kicker}>Not connected</div>
            <h2>Connect Google Analytics 4</h2>
            <p>
              Authorize your own Google account to pull real sessions, users, views and
              engagement — the Website traffic (GA4) template goes live instantly.
            </p>
          </div>
          <button type="button" className={styles.connectBtn} onClick={connect}>
            <span className={styles.g}>G</span>Connect Analytics 4
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
          <h2>Google Analytics 4</h2>
          <span className={styles.badge}>Live</span>
        </div>
        <div className={styles.controls}>
          {props.length > 0 && (
            <select
              value={property}
              onChange={(e) => {
                setProperty(e.target.value)
                // Keep the dashboards in sync with the property shown here.
                selectLiveSource('ga4', e.target.value)
              }}
            >
              {props.map((p) => (
                <option key={p.property} value={p.property}>
                  {p.displayName}
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
            <Stat label="Sessions" value={int(t.sessions)} />
            <Stat label="Users" value={int(t.users)} />
            <Stat label="Views" value={int(t.pageViews)} />
            <Stat label="Engagement rate" value={pct(t.engagementRate)} />
          </div>
          <div className={styles.rangeNote}>
            {busy
              ? 'Refreshing…'
              : `Last 28 days · ${data?.range.startDate} → ${data?.range.endDate}`}
          </div>
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
