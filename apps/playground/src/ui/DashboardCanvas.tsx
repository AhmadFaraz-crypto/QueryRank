import { useCallback, useEffect, useRef, useState } from 'react'
import { rangeName, styleBlock, type BlockConfig } from './viz/engine'
import { attachTooltips } from './viz/tooltip'
import { Viz } from './viz/Viz'
import './viz/viz.scss'
import styles from './DashboardCanvas.module.scss'

const DESKTOP = 1140
const MOBILE = 420

interface DashboardCanvasProps {
  blocks: BlockConfig[]
  device: 'desktop' | 'mobile'
  /** Theme CSS variables applied to the dashboard element. */
  vars: Record<string, string>
  gradText: boolean
  flashIds: ReadonlySet<string>
  title: string
  sub: string
  onOpen: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

export function DashboardCanvas({ blocks, device, vars, gradText, flashIds, title, sub, onOpen, onDuplicate, onDelete }: DashboardCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const dashRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [left, setLeft] = useState(0)
  const [wrapHeight, setWrapHeight] = useState(0)

  const fit = useCallback(() => {
    const wrap = wrapRef.current
    const dash = dashRef.current
    if (!wrap || !dash) return
    const w = device === 'mobile' ? MOBILE : DESKTOP
    // Desktop fills the canvas width (upscaling the 1140px design if the stage is
    // wider) so there's no empty space on the right; capped so it never gets
    // absurdly large, and any leftover is centred. Mobile stays at ≤1× centred.
    const s = device === 'mobile' ? Math.min(1, wrap.clientWidth / w) : Math.min(1.5, wrap.clientWidth / w)
    setScale(s)
    setLeft(Math.max(0, (wrap.clientWidth - w * s) / 2))
    setWrapHeight(dash.offsetHeight * s)
  }, [device])

  useEffect(() => {
    fit()
    const wrap = wrapRef.current
    const dash = dashRef.current
    if (!wrap) return
    const observer = new ResizeObserver(() => fit())
    observer.observe(wrap)
    if (dash) observer.observe(dash)
    return () => observer.disconnect()
  }, [fit, blocks])

  // Apply the active theme's CSS variables to the dashboard element.
  useEffect(() => {
    const dash = dashRef.current
    if (!dash) return
    for (const [k, v] of Object.entries(vars)) dash.style.setProperty(k, v)
    dash.classList.toggle('grad-text', gradText)
  }, [vars, gradText])

  // Chart hover tooltips (delegated over the whole canvas via data-tip).
  useEffect(() => {
    const dash = dashRef.current
    if (!dash) return
    return attachTooltips(dash)
  }, [])

  return (
    <div className={styles.scaleWrap} ref={wrapRef} style={{ height: wrapHeight }}>
      <div
        className={`${styles.dash} dash-vars compact ${device === 'mobile' ? styles.mobile : ''}`}
        ref={dashRef}
        data-export-root=""
        style={{ width: device === 'mobile' ? MOBILE : DESKTOP, transform: `scale(${scale})`, left }}
      >
        <div className={styles.dHead}>
          <div>
            <h1>{title}</h1>
            <p>{sub}</p>
          </div>
          <div className={styles.dFilters}>
            <span className={`${styles.dChip} ${styles.on}`}>Last 30 days</span>
          </div>
        </div>

        <div className={styles.dBody}>
          <div className={styles.grid}>
            {blocks.map((block) => (
              <BlockCard
                key={block.id}
                block={block}
                flash={flashIds.has(block.id)}
                onOpen={() => onOpen(block.id)}
                onDuplicate={() => onDuplicate(block.id)}
                onDelete={() => onDelete(block.id)}
              />
            ))}
          </div>
        </div>

        <div className={styles.dFoot}>
          <div className={styles.l}>
            <span className={styles.footMark}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                <rect x="3" y="12" width="4" height="9" />
                <rect x="10" y="7" width="4" height="14" />
                <rect x="17" y="3" width="4" height="18" />
              </svg>
            </span>
            <span className={styles.productName}>QueryRank</span>
          </div>
          <div className={styles.r}>
            <span>Updated 4 min ago</span>
            <span className={styles.refresh}>↻ Refresh</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface BlockCardProps {
  block: BlockConfig
  flash: boolean
  onOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function BlockCard({ block, flash, onOpen, onDuplicate, onDelete }: BlockCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Apply the block's background + series-colour overrides onto the card.
  useEffect(() => {
    if (ref.current) styleBlock(ref.current, block)
  }, [block])

  return (
    <div
      ref={ref}
      className={`card${flash ? ' flash' : ''}`}
      style={{ gridColumn: `span ${block.size}` }}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <div
        className="hover-tools"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="toolbar"
        tabIndex={-1}
        aria-label="Block actions"
      >
        <button type="button" className="edit" onClick={onOpen}>
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path d="M4 20h4L19 9l-4-4L4 16v4z" />
          </svg>
          Edit
        </button>
        <button type="button" title="Duplicate" aria-label="Duplicate" onClick={onDuplicate}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="8" y="8" width="12" height="12" rx="2" />
            <path d="M4 16V4h12" />
          </svg>
        </button>
        <button type="button" title="Delete" aria-label="Delete" onClick={onDelete}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
          </svg>
        </button>
      </div>

      <div className="c-head">
        <span className="c-title" style={block.title ? undefined : { visibility: 'hidden' }}>
          {block.title || '.'}
        </span>
        <span className="period">{rangeName(block.date)}</span>
      </div>
      <Viz cfg={block} w={block.size * 82} compact />
    </div>
  )
}
