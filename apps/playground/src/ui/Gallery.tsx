import { useMemo, useState } from 'react'
import { useStore } from './AppStore'
import { DASH_CATS, dashboardView, type Dashboard } from './data/dashboards'
import { ScaledDash } from './components/StaticDashboard'
import { DataNotLoaded } from './DataNotLoaded'
import { PreviewModal } from './PreviewModal'
import { badge, dashSources } from './viz/engine'
import styles from './Gallery.module.scss'

function timeAgo(t: number) {
  const s = (Date.now() - t) / 1000
  return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`
}

interface PreviewState {
  dash: Dashboard
  list: Dashboard[]
  isMine: boolean
}

export function Gallery() {
  const { templates, mine, newBlank, openDesigner, dataError, retryData } = useStore()
  const [tab, setTab] = useState<'templates' | 'mine'>('templates')
  const [cat, setCat] = useState('All')
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<PreviewState | null>(null)

  const q = query.trim().toLowerCase()
  const shownTemplates = useMemo(
    () => templates.filter((t) => (cat === 'All' || t.cat === cat) && (!q || `${t.n} ${t.d} ${t.cat}`.toLowerCase().includes(q))),
    [templates, cat, q],
  )
  const shownMine = useMemo(() => mine.filter((d) => !q || d.n.toLowerCase().includes(q)).sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0)), [mine, q])

  const openPreview = (dash: Dashboard, isMine: boolean) =>
    setPreview({ dash, isMine, list: isMine ? shownMine : shownTemplates.length ? shownTemplates : [dash] })

  return (
    <div className={styles.gallery}>
      <div className={styles.top}>
        <h1>Dashboards</h1>
        <div className={styles.tabs} role="tablist">
          <button type="button" className={tab === 'templates' ? styles.on : ''} onClick={() => setTab('templates')}>Templates <em>{templates.length}</em></button>
          <button type="button" className={tab === 'mine' ? styles.on : ''} onClick={() => setTab('mine')}>My dashboards <em>{mine.length}</em></button>
        </div>
        <span className={styles.sp} />
        <label className={styles.search}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <input placeholder="Search dashboards" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={newBlank}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>New dashboard
        </button>
      </div>

      <div className={styles.wrap}>
        {dataError ? (
          <DataNotLoaded onRetry={retryData} />
        ) : tab === 'templates' ? (
          <>
            <div className={styles.cats}>
              <span className={styles.lbl3}>Browse</span>
              {DASH_CATS.map((c) => (
                <button key={c} type="button" className={cat === c ? styles.on : ''} onClick={() => setCat(c)}>
                  {c}<em>{c === 'All' ? templates.length : templates.filter((t) => t.cat === c).length}</em>
                </button>
              ))}
            </div>

            <div className={styles.grid}>
              {shownTemplates.length === 0 ? (
                <div className={styles.empty}>No templates match your search.</div>
              ) : (
                shownTemplates.map((t) => <GalleryCard key={t.id} dash={t} isMine={false} onOpen={() => openPreview(t, false)} />)
              )}
            </div>
          </>
        ) : (
          <>
            <div className={styles.secH}><h3>My dashboards</h3><span>Click to preview · Edit to open the designer</span></div>
            <div className={styles.grid}>
              <button type="button" className={styles.blank} onClick={() => setTab('templates')}>
                <div>
                  <div className={styles.pl}><svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></div>
                  <b>New dashboard</b>
                  <small>Start blank or pick a template</small>
                </div>
              </button>
              {shownMine.map((d) => <GalleryCard key={d.id} dash={d} isMine onOpen={() => openPreview(d, true)} />)}
            </div>
          </>
        )}
      </div>

      {preview ? (
        <PreviewModal
          dash={preview.dash}
          list={preview.list}
          isMine={preview.isMine}
          onClose={() => setPreview(null)}
          onEdit={(dash, isMine, themeName) => { setPreview(null); openDesigner(dash, { isTemplate: !isMine, themeName }) }}
        />
      ) : null}
    </div>
  )
}

function GalleryCard({ dash, isMine, onOpen }: { dash: Dashboard; isMine: boolean; onOpen: () => void }) {
  const { vars, bg } = dashboardView(dash)
  const dots = [vars['--c1'], vars['--c2'], vars['--c3']]
  return (
    <button type="button" className={styles.card} onClick={onOpen}>
      <div className={styles.shot} style={{ background: bg }}>
        {dash.badge && !isMine ? <span className={`${styles.badge} ${dash.badge === 'New' ? styles.new : ''}`}>{dash.badge}</span> : null}
        {isMine ? <span className={styles.badge}>Edited {timeAgo(dash.updated ?? Date.now())}</span> : null}
        <ScaledDash dash={dash} vars={vars} bg={bg} />
        <div className={styles.hov}>
          <span><svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>Preview</span>
        </div>
      </div>
      <div className={styles.info}>
        <h3>{dash.n}</h3>
        <p>{dash.d ?? ''}</p>
        <div className={styles.meta}>
          <span className={styles.srcs}>
            {dashSources(dash.blocks).map((s) => {
              const b = badge(s)
              return <span key={s} className={styles.srcBadge} style={{ background: b.bg }} title={s}>{b.t}</span>
            })}
          </span>
          <span>{dash.blocks.length} blocks · {dash.cat}</span>
          <span className={styles.dots}>{dots.map((c, i) => <b key={i} style={{ background: c }} />)}</span>
        </div>
      </div>
    </button>
  )
}
