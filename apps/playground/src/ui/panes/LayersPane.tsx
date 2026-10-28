import { useState, type DragEvent } from 'react'
import { typeName, vizSvg, type BlockConfig } from '../viz/engine'
import styles from './panes.module.scss'

interface LayersPaneProps {
  blocks: BlockConfig[]
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onReorder: (fromId: string, toId: string) => void
}

const SIZE_LABEL: Record<number, string> = { 3: 'S', 4: 'M', 5: 'M+', 6: 'L', 12: 'Wide' }

export function LayersPane({ blocks, onOpen, onDelete, onReorder }: LayersPaneProps) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  return (
    <section className={styles.pane}>
      <header className={styles.head}>
        <div>
          <h2>Layers</h2>
          <p>Drag to reorder · click to edit</p>
        </div>
      </header>
      <div className={styles.scroll}>
        {blocks.length === 0 ? (
          <div className={styles.empty}>The dashboard is empty.</div>
        ) : (
          blocks.map((b) => (
            <div
              key={b.id}
              className={`${styles.layer} ${dragId === b.id ? styles.dragging : ''} ${overId === b.id ? styles.over : ''}`}
              draggable
              onClick={() => onOpen(b.id)}
              onDragStart={(e: DragEvent) => { setDragId(b.id); e.dataTransfer.setData('text/plain', 'layer') }}
              onDragEnd={() => { setDragId(null); setOverId(null) }}
              onDragOver={(e: DragEvent) => { if (dragId) { e.preventDefault(); setOverId(b.id) } }}
              onDragLeave={() => setOverId((cur) => (cur === b.id ? null : cur))}
              onDrop={(e: DragEvent) => { e.preventDefault(); setOverId(null); if (dragId && dragId !== b.id) onReorder(dragId, b.id) }}
            >
              <svg className={styles.grip} width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
              <span className={styles.li} dangerouslySetInnerHTML={{ __html: vizSvg(b.type) }} />
              <div className={styles.t}>
                {b.title || 'Untitled'}
                <small>{typeName(b.type)} · {b.metrics.map((m) => m.label).join(', ') || 'no data'}</small>
              </div>
              <span className={styles.sz}>{SIZE_LABEL[b.size] ?? b.size}</span>
              <button type="button" className={styles.del} title="Delete block" onClick={(e) => { e.stopPropagation(); onDelete(b.id) }}>×</button>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
