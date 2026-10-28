import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DATE_GROUPS } from '../viz/engine'
import styles from './DateRangeMenu.module.scss'

interface DateRangeMenuProps {
  /** Current range key (a DATE_GROUPS key or `cust:<days>`). */
  value: string
  /** The label shown on the trigger chip. */
  label: string
  onChange: (key: string, label: string) => void
  /** Visual size of the trigger chip. */
  size?: 'sm' | 'md'
}

const GROUPS = [...DATE_GROUPS.map((g) => g.group), 'Custom']

function groupForKey(key: string): string {
  if (key.startsWith('cust:')) return 'Custom'
  const g = DATE_GROUPS.find((grp) => grp.items.some((it) => it.key === key))
  return g?.group ?? 'Popular'
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function DateRangeMenu({ value, label, onChange, size = 'sm' }: DateRangeMenuProps) {
  const [open, setOpen] = useState(false)
  const [activeGroup, setActiveGroup] = useState(() => groupForKey(value))
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean }>({
    top: 0,
    left: 0,
    up: false,
  })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  // Custom-range inputs (default to a trailing 30-day window ending today).
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    if (!open) return
    setActiveGroup(groupForKey(value))
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
  }, [open, value])

  // Position the popover against the trigger, flipping near the viewport edges.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const W = 360
    const H = popRef.current?.offsetHeight ?? 240
    let left = r.right - W
    if (left < 8) left = 8
    if (left + W > window.innerWidth - 8) left = window.innerWidth - W - 8
    const up = r.bottom + H + 8 > window.innerHeight && r.top - H - 8 > 0
    const top = up ? r.top - H - 6 : r.bottom + 6
    setPos({ top, left, up })
  }, [open])

  const pick = (key: string, lbl: string) => {
    onChange(key, lbl)
    setOpen(false)
  }

  const applyCustom = () => {
    if (!from || !to) return
    const f = new Date(from)
    const t = new Date(to)
    if (isNaN(+f) || isNaN(+t) || t < f) return
    const days = Math.round((+t - +f) / 86400000) + 1
    pick(`cust:${days}`, `${fmtDay(f)} – ${fmtDay(t)}`)
  }

  const activeItems = DATE_GROUPS.find((g) => g.group === activeGroup)?.items ?? []

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${size === 'md' ? styles.md : ''} ${open ? styles.open : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{label}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={popRef}
            className={styles.pop}
            style={{ top: pos.top, left: pos.left }}
            role="dialog"
          >
            <div className={styles.groups}>
              {GROUPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`${styles.group} ${activeGroup === g ? styles.active : ''}`}
                  onMouseEnter={() => setActiveGroup(g)}
                  onClick={() => setActiveGroup(g)}
                >
                  {g}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M9 6l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ))}
            </div>
            <div className={styles.options}>
              {activeGroup === 'Custom' ? (
                <div className={styles.custom}>
                  <label>
                    <span>From</span>
                    <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                  </label>
                  <label>
                    <span>To</span>
                    <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                  </label>
                  <button
                    type="button"
                    className={styles.apply}
                    disabled={!from || !to}
                    onClick={applyCustom}
                  >
                    Apply range
                  </button>
                </div>
              ) : (
                activeItems.map((it) => (
                  <button
                    key={it.key}
                    type="button"
                    className={`${styles.opt} ${value === it.key ? styles.sel : ''}`}
                    onClick={() => pick(it.key, it.label)}
                  >
                    <span>{it.label}</span>
                    {value === it.key && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M5 13l4 4L19 7"
                          stroke="currentColor"
                          strokeWidth="2.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
