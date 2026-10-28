import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { blockFromType, draw, esc, typeName } from '../viz/engine'
import styles from './panes.module.scss'

interface ChartCatalogItem {
  k: string
  cat: string
  d: string
  pop?: boolean
}

const CHART_CATALOG: ChartCatalogItem[] = [
  { k: 'line', cat: 'Trends', d: 'Change over time', pop: true },
  { k: 'bar', cat: 'Trends', d: 'Compare periods side by side', pop: true },
  { k: 'number', cat: 'Trends', d: 'One KPI with its change', pop: true },
  { k: 'heatmap', cat: 'Trends', d: 'Spot busy days and weeks' },
  { k: 'hbar', cat: 'Compare', d: 'Rank items or segments', pop: true },
  { k: 'table', cat: 'Compare', d: 'Exact values with share' },
  { k: 'bubble', cat: 'Compare', d: 'Relative size at a glance' },
  { k: 'spider', cat: 'Compare', d: 'Balance across dimensions' },
  { k: 'pie', cat: 'Part of whole', d: 'Share of a total', pop: true },
  { k: 'funnel', cat: 'Part of whole', d: 'Drop-off between steps' },
  { k: 'pipeline', cat: 'Part of whole', d: 'Volume at each stage' },
  { k: 'radial', cat: 'Part of whole', d: 'Compare a few segments' },
  { k: 'gauge', cat: 'Goals', d: 'Progress toward a target' },
  { k: 'progress', cat: 'Goals', d: 'Simple bar to a goal' },
]
const CATS = ['All', 'Popular', 'Trends', 'Compare', 'Part of whole', 'Goals']

interface ChartsPaneProps {
  vars: Record<string, string>
  onAdd: (k: string) => void
}

export function ChartsPane({ vars, onAdd }: ChartsPaneProps) {
  const [cat, setCat] = useState('All')
  const [query, setQuery] = useState('')

  const items = useMemo(
    () =>
      CHART_CATALOG.filter(
        (i) =>
          (cat === 'All' || (cat === 'Popular' ? i.pop : i.cat === cat)) &&
          (!query || (typeName(i.k) + ' ' + i.d + ' ' + i.cat).toLowerCase().includes(query.toLowerCase())),
      ),
    [cat, query],
  )
  const groups = cat === 'All' && !query ? [...new Set(items.map((i) => i.cat))] : [null]

  return (
    <section className={styles.pane}>
      <header className={styles.head}>
        <div>
          <h2>Charts</h2>
          <p>Drag onto the canvas or click to add</p>
        </div>
      </header>
      <label className={styles.search}>
        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        <input placeholder="Search charts, e.g. trend, share…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className={styles.cats}>
        {CATS.map((c) => (
          <button key={c} type="button" className={`${styles.cat} ${cat === c ? styles.on : ''}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <div className={styles.scroll}>
        {items.length === 0 ? (
          <div className={styles.empty} dangerouslySetInnerHTML={{ __html: `No charts match “${esc(query)}”.` }} />
        ) : (
          groups.map((g, gi) => (
            <div key={g ?? gi}>
              {g ? <div className={styles.groupH}>{g}</div> : null}
              <div className={styles.cGrid}>
                {items.filter((i) => !g || i.cat === g).map((i) => (
                  <ChartCard key={i.k} item={i} vars={vars} onAdd={() => onAdd(i.k)} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function ChartCard({ item, vars, onAdd }: { item: ChartCatalogItem; vars: Record<string, string>; onAdd: () => void }) {
  const thumbRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const thumb = thumbRef.current
    if (thumb) {
      for (const [k, v] of Object.entries(vars)) if (/^--(c\d|g1|track|card-)/.test(k)) thumb.style.setProperty(k, v)
      // thumbnails always read as light so they stand out in the panel
      thumb.style.setProperty('--card-ink', '#111827')
      thumb.style.setProperty('--card-ink-2', '#4B5563')
      thumb.style.setProperty('--card-muted', '#8A919E')
      thumb.style.setProperty('--track', '#E6E8F0')
    }
    if (hostRef.current) draw(hostRef.current, item.k, blockFromType(item.k), { thumb: true, W: 200 })
  }, [item.k, vars])

  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData('text/plain', 'viz:' + item.k)
  }

  return (
    <div className={styles.cCard} draggable onDragStart={onDragStart} onClick={onAdd} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onAdd() }} title={`Drag ${typeName(item.k)} onto the canvas`}>
      <div className={`${styles.cThumb} dash-vars`} ref={thumbRef}>
        <div className="card">
          <div className="th-host" ref={hostRef} />
        </div>
      </div>
      <div className={styles.nm}>
        {typeName(item.k)}
        {item.pop ? <span className={styles.pop}>Popular</span> : null}
      </div>
      <div className={styles.ds}>{item.d}</div>
      <button type="button" className={styles.add} aria-label={`Add ${typeName(item.k)}`} onClick={(e) => { e.stopPropagation(); onAdd() }}>
        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </div>
  )
}
