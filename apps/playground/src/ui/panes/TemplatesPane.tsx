import { useState } from 'react'
import { TEMPLATES, TEMPLATE_CATS, type DashTemplate } from './templates'
import styles from './panes.module.scss'

interface TemplatesPaneProps {
  onAdd: (template: DashTemplate) => void
}

export function TemplatesPane({ onAdd }: TemplatesPaneProps) {
  const [cat, setCat] = useState('All')
  const groups = cat === 'All' ? TEMPLATE_CATS.slice(1) : [cat]

  return (
    <section className={styles.pane}>
      <header className={styles.head}>
        <div>
          <h2>Templates</h2>
          <p>Add a ready-made group of blocks</p>
        </div>
      </header>
      <div className={styles.cats}>
        {TEMPLATE_CATS.map((c) => (
          <button key={c} type="button" className={`${styles.cat} ${cat === c ? styles.on : ''}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <div className={styles.scroll}>
        {groups.map((g) => (
          <div key={g}>
            <div className={styles.groupH}>{g}</div>
            {TEMPLATES.filter((t) => t.cat === g).map((t) => {
              const dark = /#1E1B4B|#0F172A/.test(t.bg)
              return (
                <button key={t.n} type="button" className={styles.tpl} onClick={() => onAdd(t)}>
                  <div className={`${styles.tplPrev} ${dark ? styles.dk : ''}`} style={{ background: t.bg }}>
                    {t.layout.map(([span, cls], i) => (
                      <i key={i} className={cls ? cls.split(' ').map((c) => styles[c as keyof typeof styles]).filter(Boolean).join(' ') : ''} style={{ gridColumn: `span ${span}` }} />
                    ))}
                  </div>
                  <div className={styles.meta}>
                    <div><b>{t.n}</b><small>{t.d}</small></div>
                    <span>+ {t.blocks.length} block{t.blocks.length > 1 ? 's' : ''}</span>
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}
