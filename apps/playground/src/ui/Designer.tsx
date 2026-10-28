import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardCanvas } from './DashboardCanvas'
import { FocusStudio } from './FocusStudio'
import { PreviewModal } from './PreviewModal'
import { ThemePanel } from './ThemePanel'
import type { Dashboard } from './data/dashboards'
import { ChartsPane } from './panes/ChartsPane'
import { TemplatesPane } from './panes/TemplatesPane'
import { LayersPane } from './panes/LayersPane'
import type { DashTemplate } from './panes/templates'
import { useStore } from './AppStore'
import { exportDashboardPdf, exportDashboardPng } from './exportDashboard'
import { blockFromType, defaultBlocks, type BlockConfig } from './viz/engine'
import { presetTheme, themeVars, type Theme } from './viz/theme'
import styles from './Designer.module.scss'

const cloneBlocks = (blocks: BlockConfig[]) => blocks.map((b) => JSON.parse(JSON.stringify(b)) as BlockConfig)

type SideTab = 'charts' | 'templates' | 'layers'

function Svg({ paths, className }: { paths: string; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      dangerouslySetInnerHTML={{ __html: paths }}
    />
  )
}

const SIDE_TABS: Array<{ key: SideTab; label: string; paths: string }> = [
  { key: 'charts', label: 'Charts', paths: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke-linecap="round"/>' },
  { key: 'templates', label: 'Templates', paths: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="8" height="7" rx="2"/><rect x="15" y="14" width="6" height="7" rx="2"/>' },
  { key: 'layers', label: 'Layers', paths: '<path d="M12 3l9 5-9 5-9-5z" stroke-linejoin="round"/><path d="M3 13l9 5 9-5" stroke-linejoin="round"/>' },
]

export function Designer() {
  const navigate = useNavigate()
  const { active, saveActive } = useStore()

  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [tab, setTab] = useState<SideTab>('charts')

  const [blocks, setBlocks] = useState<BlockConfig[]>(() =>
    active?.blocks.length ? cloneBlocks(active.blocks) : active ? [] : defaultBlocks(),
  )
  const [studioId, setStudioId] = useState<string | null>(null)
  const studioBlock = blocks.find((b) => b.id === studioId) ?? null

  const [theme, setTheme] = useState<Theme>(() => active?.themeState ?? presetTheme(active?.theme ?? 'Clean'))
  const [theming, setTheming] = useState(false)
  const dashVars = useMemo(() => themeVars(theme), [theme])

  const dashTitle = active?.n ?? 'Sample Dashboard'
  const dashSub = `${active?.sub ?? active?.d ?? 'Store performance'} · updated just now`

  // Export the live canvas (exactly as rendered) to a PNG or PDF.
  const [exportOpen, setExportOpen] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const doExport = async (format: 'png' | 'pdf') => {
    const node = document.querySelector<HTMLElement>('[data-export-root]')
    if (!node) return
    setExportOpen(false)
    setExportBusy(true)
    try {
      if (format === 'png') await exportDashboardPng(node, dashTitle)
      else await exportDashboardPdf(node, dashTitle)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExportBusy(false)
    }
  }

  // Re-initialise when a different dashboard is opened.
  const loadedId = useRef(active?.id)
  useEffect(() => {
    if (active && active.id !== loadedId.current) {
      loadedId.current = active.id
      setBlocks(active.blocks.length ? cloneBlocks(active.blocks) : [])
      setTheme(active.themeState ?? presetTheme(active.theme))
      setStudioId(null)
    }
  }, [active])

  // Keep the store in sync so the gallery/home reflect edits.
  useEffect(() => {
    saveActive(blocks, theme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, theme])

  // toast
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const showToast = useCallback((message: string) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }, [])

  // Preview: open the read-only preview modal for the dashboard as edited.
  const [previewing, setPreviewing] = useState(false)
  const previewDash: Dashboard = useMemo(
    () => ({
      id: active?.id ?? 'draft',
      n: dashTitle,
      d: active?.d,
      cat: active?.cat ?? 'Custom',
      sub: active?.sub ?? active?.d,
      theme: active?.theme ?? theme.preset ?? 'Clean',
      themeState: theme,
      blocks,
      updated: Date.now(),
    }),
    [active, dashTitle, theme, blocks],
  )

  // Publish: flush the save immediately (don't wait on the debounce), confirm,
  // and return to the dashboards gallery where it now appears.
  const handlePublish = useCallback(() => {
    saveActive(blocks, theme)
    showToast('Dashboard published — saved to your dashboards')
    setTimeout(() => navigate('/dashboards'), 900)
  }, [saveActive, blocks, theme, showToast, navigate])

  const openBlock = useCallback((id: string) => setStudioId(id), [])

  const duplicateBlock = useCallback(
    (id: string) => {
      setBlocks((prev) => {
        const idx = prev.findIndex((b) => b.id === id)
        if (idx === -1) return prev
        const copy: BlockConfig = { ...JSON.parse(JSON.stringify(prev[idx])), id: `b${Date.now()}` }
        const next = [...prev]
        next.splice(idx + 1, 0, copy)
        return next
      })
      showToast('Block duplicated')
    },
    [showToast],
  )

  const deleteBlock = useCallback(
    (id: string) => {
      setBlocks((prev) => prev.filter((b) => b.id !== id))
      setStudioId((cur) => (cur === id ? null : cur))
      showToast('Block deleted')
    },
    [showToast],
  )

  const saveBlock = useCallback(
    (cfg: BlockConfig) => {
      setBlocks((prev) => prev.map((b) => (b.id === cfg.id ? cfg : b)))
      setStudioId(null)
      showToast('Saved to dashboard')
    },
    [showToast],
  )

  // Persist a draft without closing (used when switching blocks mid-edit).
  const persistBlock = useCallback((cfg: BlockConfig) => {
    setBlocks((prev) => prev.map((b) => (b.id === cfg.id ? cfg : b)))
  }, [])

  // ---- adding blocks from the side panel ----
  const [flashIds, setFlashIds] = useState<ReadonlySet<string>>(new Set())
  const flashTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const tplSeq = useRef(0)
  const flash = useCallback((id: string) => {
    setFlashIds((prev) => new Set(prev).add(id))
    flashTimers.current.push(
      setTimeout(() => setFlashIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      }), 1000),
    )
  }, [])

  // Add a chart block → opens straight in the studio.
  const addChart = useCallback((k: string) => {
    const b = blockFromType(k)
    setBlocks((prev) => [...prev, b])
    setStudioId(b.id)
  }, [])

  const addTemplate = useCallback(
    (t: DashTemplate) => {
      const fresh = t.blocks.map((b) => ({ ...JSON.parse(JSON.stringify(b)), id: `tb${tplSeq.current++}` }) as BlockConfig)
      setBlocks((prev) => [...prev, ...fresh])
      if (fresh[0]) flash(fresh[0].id)
      showToast(`Added “${t.n}”`)
    },
    [flash, showToast],
  )

  const reorderBlocks = useCallback((fromId: string, toId: string) => {
    setBlocks((prev) => {
      const from = prev.findIndex((b) => b.id === fromId)
      if (from === -1) return prev
      const arr = [...prev]
      const [moved] = arr.splice(from, 1)
      const to = arr.findIndex((b) => b.id === toId)
      arr.splice(to === -1 ? arr.length : to, 0, moved)
      return arr
    })
    showToast('Order updated')
  }, [showToast])

  // ---- drag a chart from the panel onto the canvas ----
  const [dropActive, setDropActive] = useState(false)
  const onCanvasDragOver = (e: DragEvent) => {
    e.preventDefault()
    setDropActive(true)
  }
  const onCanvasDrop = (e: DragEvent) => {
    e.preventDefault()
    setDropActive(false)
    const [kind, value] = e.dataTransfer.getData('text/plain').split(':')
    if (kind === 'viz') addChart(value)
  }

  return (
    <div className={styles.main}>
      {/* TOP BAR */}
      <header className={styles.topbar}>
        <div className={styles.crumb}>
          <button type="button" className={styles.crumbLink} onClick={() => navigate('/dashboards')}>Dashboards</button>
          <span className={`${styles.sep} ${styles.mutedPart}`}>/</span>
          <button className={styles.dashSelect} type="button">
            <span className={styles.dot} />
            {dashTitle}
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
        <span className={styles.status}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" />
          </svg>
          All changes saved
        </span>

        <div className={styles.device} role="group" aria-label="Preview size">
          <button
            type="button"
            className={device === 'desktop' ? styles.on : ''}
            onClick={() => setDevice('desktop')}
          >
            <svg className={styles.ico16} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="12" rx="1.5" />
              <path d="M8 20h8M12 16v4" />
            </svg>
            Desktop
          </button>
          <button
            type="button"
            className={device === 'mobile' ? styles.on : ''}
            onClick={() => setDevice('mobile')}
          >
            <svg className={styles.ico16} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <rect x="7" y="3" width="10" height="18" rx="2" />
              <path d="M11 18h2" />
            </svg>
            Mobile
          </button>
        </div>

        <div className={styles.topRight}>
          <button className={styles.btn} type="button" onClick={() => setPreviewing(true)}>
            <svg className={styles.ico16} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Preview
          </button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={handlePublish}>
            Publish
          </button>
          <button className={`${styles.btn} ${styles.btnIcon} ${styles.btnGhost}`} type="button" title="Exit designer" aria-label="Exit designer" onClick={() => navigate('/dashboards')}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </header>

      <div className={`${styles.workspace} ${theming ? styles.theming : ''}`}>
        {/* SIDE PANEL */}
        <aside className={styles.side}>
          <nav className={styles.sbTabs} role="tablist" aria-label="Builder panels">
            {SIDE_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`${styles.sbTab} ${tab === t.key ? styles.on : ''}`}
                onClick={() => setTab(t.key)}
                title={t.label}
              >
                <Svg paths={t.paths} />
                <span>{t.label}</span>
              </button>
            ))}
          </nav>

          <div className={styles.sbPanel}>
            {tab === 'charts' ? <ChartsPane vars={dashVars} onAdd={addChart} /> : null}
            {tab === 'templates' ? <TemplatesPane onAdd={addTemplate} /> : null}
            {tab === 'layers' ? (
              <LayersPane blocks={blocks} onOpen={openBlock} onDelete={deleteBlock} onReorder={reorderBlocks} />
            ) : null}
          </div>
        </aside>

        {/* STAGE */}
        <section className={styles.stage}>
          <div className={styles.canvasBar}>
            <div className={styles.grp}>
              <button className={`${styles.tb} ${theming ? styles.tbOn : ''}`} type="button" onClick={() => setTheming((t) => !t)}>
                <span className={styles.themeDot} />
                Theme
              </button>
              <button className={styles.tb} type="button">
                <svg className={styles.ico16} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path d="M14 4l6 6-9 9H5v-6z" />
                </svg>
                Visuals
              </button>
              <button className={styles.tb} type="button">
                <svg className={styles.ico16} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15L6 16zM10 20a2 2 0 004 0" />
                </svg>
                Alerts
              </button>
            </div>
            <div className={styles.grp}>
              <div className={styles.exportWrap}>
                <button
                  className={`${styles.tb} ${exportOpen ? styles.tbOn : ''}`}
                  type="button"
                  title="Export as PNG or PDF"
                  onClick={() => setExportOpen((o) => !o)}
                  disabled={exportBusy}
                >
                  <svg className={styles.ico16} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" />
                  </svg>
                  {exportBusy ? 'Exporting…' : 'Export'}
                </button>
                {exportOpen ? (
                  <>
                    <div className={styles.exportBackdrop} onClick={() => setExportOpen(false)} />
                    <div className={styles.exportMenu} role="menu">
                      <button type="button" onClick={() => doExport('png')}>
                        PNG image
                      </button>
                      <button type="button" onClick={() => doExport('pdf')}>
                        PDF document
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
              <button className={styles.tb} type="button" title="Share" aria-label="Share">
                <svg className={styles.ico16} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <circle cx="18" cy="5" r="2.5" />
                  <circle cx="6" cy="12" r="2.5" />
                  <circle cx="18" cy="19" r="2.5" />
                  <path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" />
                </svg>
              </button>
              <button className={styles.tb} type="button" title="Present" aria-label="Present">
                <svg className={styles.ico16} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="12" rx="1.5" />
                  <path d="M8 20h8M12 16v4" />
                </svg>
              </button>
              <button className={styles.tb} type="button" title="More" aria-label="More">
                <svg className={styles.ico16} fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="5" cy="12" r="1.7" />
                  <circle cx="12" cy="12" r="1.7" />
                  <circle cx="19" cy="12" r="1.7" />
                </svg>
              </button>
            </div>
          </div>

          <div
            className={`${styles.frame} ${dropActive ? styles.drop : ''}`}
            onDragOver={onCanvasDragOver}
            onDragLeave={() => setDropActive(false)}
            onDrop={onCanvasDrop}
          >
            <DashboardCanvas
              blocks={blocks}
              device={device}
              vars={dashVars}
              gradText={theme.gradText}
              flashIds={flashIds}
              title={dashTitle}
              sub={dashSub}
              onOpen={openBlock}
              onDuplicate={duplicateBlock}
              onDelete={deleteBlock}
            />
          </div>

          <div className={styles.looped}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M17 2l4 4-4 4" />
              <path d="M3 11v-1a4 4 0 014-4h14M7 22l-4-4 4-4" />
              <path d="M21 13v1a4 4 0 01-4 4H3" />
            </svg>
            <span>
              <b>Looped dashboards</b> · rotate several dashboards on a TV screen
            </span>
            <button className={styles.ext} type="button">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add dashboard
            </button>
          </div>
        </section>

        {theming ? (
          <ThemePanel theme={theme} onChange={setTheme} onClose={() => setTheming(false)} onToast={showToast} />
        ) : null}
      </div>

      {studioBlock ? (
        <FocusStudio
          block={studioBlock}
          allBlocks={blocks}
          vars={dashVars}
          onSave={saveBlock}
          onPersist={persistBlock}
          onClose={() => setStudioId(null)}
          onSwitch={setStudioId}
          onToast={showToast}
        />
      ) : null}

      <div className={`${styles.toast} ${toast ? styles.toastShow : ''}`}>{toast}</div>

      {previewing ? (
        <PreviewModal
          dash={previewDash}
          list={[previewDash]}
          isMine
          onClose={() => setPreviewing(false)}
          onEdit={() => setPreviewing(false)}
        />
      ) : null}
    </div>
  )
}
