import { useLayoutEffect, useRef } from 'react'
import { useStore } from '../AppStore'
import { draw, type BlockConfig } from './engine'

interface VizProps {
  cfg: BlockConfig
  /** Override the chart type (used by the strip thumbnails). Defaults to cfg.type. */
  type?: string
  thumb?: boolean
  /** Tighter spacing + shorter charts (matches the preview modal). */
  compact?: boolean
  /** Drawing width passed to the engine. */
  w?: number
}

// Charts that grow to fill the card's real height (same set as the preview
// renderer's second pass) so there's no blank space beside taller neighbours.
const FILLABLE = new Set(['line', 'bar', 'hbar', 'bubble', 'pie'])

/** Renders a chart by driving the imperative engine into a host div. */
export function Viz({ cfg, type, thumb, compact, w }: VizProps) {
  const ref = useRef<HTMLDivElement>(null)
  // Redraw when live source data is (re)loaded into the engine.
  const { liveVersion } = useStore()
  useLayoutEffect(() => {
    const host = ref.current
    if (!host) return
    const t = type ?? cfg.type
    const render = () => {
      draw(host, t, cfg, { thumb, compact, W: w })
      // Second pass: redraw at the card's real height so the chart fills it,
      // matching the preview/export renderer exactly.
      if (!thumb && w && FILLABLE.has(t)) {
        const cw = host.clientWidth
        const ch = host.clientHeight
        if (cw > 0 && ch > 0)
          draw(host, t, cfg, { thumb, compact, W: w, fillH: Math.round((ch * w) / cw) })
      }
    }
    render()
    if (thumb || !w || !FILLABLE.has(t)) return
    // Re-fill when the card's height changes (e.g. a sibling resizes the row).
    const ro = new ResizeObserver(() => render())
    ro.observe(host)
    return () => ro.disconnect()
  }, [cfg, type, thumb, compact, w, liveVersion])
  return <div className="viz-host" ref={ref} />
}
