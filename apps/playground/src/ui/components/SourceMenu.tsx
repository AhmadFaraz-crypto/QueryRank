import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './SourceMenu.module.scss'

interface Option {
  value: string
  label: string
}
interface SourceMenuProps {
  /** What kind of source this is — drives the trigger label and icon. */
  kind: 'gsc' | 'ga4'
  options: Option[]
  selected: string
  onChange: (value: string) => void
}

// Search Console sites come as `sc-domain:example.com` or `https://example.com/`.
// GA4 properties as `properties/123456789`. Show the readable part either way.
function shortLabel(kind: 'gsc' | 'ga4', value: string, label: string): string {
  if (kind === 'ga4') return label.replace(/^properties\//, '') || value
  const raw = value.replace(/^sc-domain:/, '')
  try {
    return new URL(raw).hostname || raw
  } catch {
    return raw.replace(/^https?:\/\//, '').replace(/\/$/, '')
  }
}

export function SourceMenu({ kind, options, selected, onChange }: SourceMenuProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (
        !popRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      )
        setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const W = 260
    let left = r.left
    if (left + W > window.innerWidth - 8) left = window.innerWidth - W - 8
    if (left < 8) left = 8
    setPos({ top: r.bottom + 6, left })
  }, [open])

  const current = options.find((o) => o.value === selected)
  const triggerText = current ? shortLabel(kind, current.value, current.label) : 'Select source'

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`d-chip ${styles.trigger} ${open ? styles.open : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={current?.value}
      >
        <span className={styles.dot} data-kind={kind} />
        <span className={styles.text}>{triggerText}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            className={styles.pop}
            style={{ top: pos.top, left: pos.left }}
            role="listbox"
          >
            <div className={styles.head}>
              {kind === 'gsc' ? 'Search Console site' : 'GA4 property'}
            </div>
            {options.map((o) => {
              const on = o.value === selected
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={`${styles.opt} ${on ? styles.on : ''}`}
                  onClick={() => {
                    if (!on) onChange(o.value)
                    setOpen(false)
                  }}
                  title={o.value}
                >
                  <span className={styles.optText}>{shortLabel(kind, o.value, o.label)}</span>
                  {on && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M5 13l4 4L19 7"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}
