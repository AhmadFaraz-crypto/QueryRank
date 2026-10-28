// A single shared, styled tooltip for the imperative charts. Chart elements get
// a `data-tip` attribute (the main label) and, optionally, `data-tip-sub` (a
// secondary line, e.g. a day-over-day change) plus `data-tip-dir`
// ('up' | 'down' | 'flat') which colours that line. attachTooltips wires a
// delegated hover handler on a dashboard root that shows the tip at the cursor.

let tip: HTMLDivElement | null = null
let mainEl: HTMLDivElement | null = null
let subEl: HTMLDivElement | null = null

function getTip(): { t: HTMLDivElement; main: HTMLDivElement; sub: HTMLDivElement } {
  if (tip && mainEl && subEl) return { t: tip, main: mainEl, sub: subEl }
  tip = document.createElement('div')
  tip.className = 'viz-tip'
  mainEl = document.createElement('div')
  mainEl.className = 'viz-tip-main'
  subEl = document.createElement('div')
  subEl.className = 'viz-tip-sub'
  tip.append(mainEl, subEl)
  document.body.appendChild(tip)
  return { t: tip, main: mainEl, sub: subEl }
}

/** Wire hover tooltips for every `[data-tip]` element under `root`. */
export function attachTooltips(root: HTMLElement): () => void {
  const { t, main, sub } = getTip()
  const onMove = (e: MouseEvent) => {
    const el = (e.target as Element)?.closest?.('[data-tip]') as HTMLElement | null
    if (!el) {
      t.classList.remove('on')
      return
    }
    main.textContent = el.getAttribute('data-tip') || ''
    const subText = el.getAttribute('data-tip-sub') || ''
    sub.textContent = subText
    sub.style.display = subText ? '' : 'none'
    const dir = el.getAttribute('data-tip-dir') || ''
    sub.className = `viz-tip-sub${dir ? ` ${dir}` : ''}`
    t.classList.add('on')
    const pad = 14
    let x = e.clientX + pad
    let y = e.clientY - 10
    if (x + t.offsetWidth > window.innerWidth - 8) x = e.clientX - t.offsetWidth - pad
    if (y < 8) y = e.clientY + 20
    t.style.transform = `translate(${x}px, ${y}px)`
  }
  const onLeave = () => t.classList.remove('on')
  root.addEventListener('mousemove', onMove)
  root.addEventListener('mouseleave', onLeave)
  return () => {
    root.removeEventListener('mousemove', onMove)
    root.removeEventListener('mouseleave', onLeave)
  }
}
