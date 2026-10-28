import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  CARD,
  GRADS,
  PALETTES,
  SOLIDS,
  THEMES,
  applyPreset,
  defaultTheme,
  gradCss,
  loadGrad,
  presetCss,
  type Theme,
} from './viz/theme'
import styles from './ThemePanel.module.scss'

interface ThemePanelProps {
  theme: Theme
  onChange: (theme: Theme) => void
  onClose: () => void
  onToast: (message: string) => void
}

type Tab = 'themes' | 'background' | 'cards'

const clone = (t: Theme): Theme => JSON.parse(JSON.stringify(t))

export function ThemePanel({ theme, onChange, onClose, onToast }: ThemePanelProps) {
  const [tab, setTab] = useState<Tab>('themes')

  const set = (fn: (t: Theme) => void) => {
    const t = clone(theme)
    fn(t)
    onChange(t)
  }

  const bg = theme.bg
  const previewCss = bg.mode === 'solid' ? bg.solid : gradCss(bg)

  return (
    <aside className={styles.panel} aria-label="Dashboard theme">
      <div className={styles.head}>
        <span className={`${styles.tiBox} ${styles.grad}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 3a9 9 0 100 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A4.6 4.6 0 0021 9.8C21 6 17 3 12 3z" />
            <circle cx="7.5" cy="11" r="1.3" fill="currentColor" />
            <circle cx="10.5" cy="7" r="1.3" fill="currentColor" />
            <circle cx="15.5" cy="7.5" r="1.3" fill="currentColor" />
          </svg>
        </span>
        <div>
          <h3>Dashboard theme</h3>
          <small>Background, cards and chart colours</small>
        </div>
        <button className={styles.iconBtn} type="button" aria-label="Close theme panel" onClick={onClose}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div className={styles.tabs} role="tablist">
        {(['themes', 'background', 'cards'] as Tab[]).map((t) => (
          <button key={t} type="button" className={tab === t ? styles.on : ''} onClick={() => setTab(t)}>
            {t === 'themes' ? 'Themes' : t === 'background' ? 'Background' : 'Cards & charts'}
          </button>
        ))}
      </div>

      <div className={styles.body}>
        {/* ---------- THEMES ---------- */}
        {tab === 'themes' ? (
          <div className={styles.sec}>
            <div className={styles.secT}>Ready-made themes</div>
            <div className={styles.themeGrid}>
              {THEMES.map((t) => {
                const pal = PALETTES.find((p) => p.n === t.pal)!
                const cs = CARD[t.card]
                const tb = t.bg
                const thumbBg = tb.mode === 'solid' ? tb.solid : presetCss(GRADS.find((g) => g.n === tb.g)!)
                return (
                  <button
                    key={t.n}
                    type="button"
                    className={`${styles.themeCard} ${theme.preset === t.n ? styles.on : ''}`}
                    onClick={() => onChange(applyPreset(theme, t))}
                  >
                    <div className={styles.themeThumb} style={{ background: thumbBg, ['--tc1' as string]: pal.c[0], ['--tg1' as string]: pal.g }}>
                      <i style={{ background: cs.bg, backdropFilter: cs.blur }} />
                      <i style={{ background: cs.bg }} />
                      <i style={{ background: cs.bg }} />
                    </div>
                    <span>
                      {t.n}
                      <em>{pal.c.slice(0, 3).map((c, i) => <b key={i} style={{ background: c }} />)}</em>
                    </span>
                  </button>
                )
              })}
            </div>
            <p className={styles.hint}>A theme sets the background, card style and chart colours together. Fine-tune any part in the other tabs.</p>
          </div>
        ) : null}

        {/* ---------- BACKGROUND ---------- */}
        {tab === 'background' ? (
          <>
            <div className={styles.sec}>
              <div className={styles.seg}>
                {(['solid', 'gradient'] as const).map((m) => (
                  <button key={m} type="button" className={bg.mode === m ? styles.on : ''} onClick={() => set((t) => { t.bg.mode = m; t.preset = '' })}>
                    {m === 'solid' ? 'Solid colour' : 'Gradient'}
                  </button>
                ))}
              </div>

              {bg.mode === 'solid' ? (
                <div className={styles.mt}>
                  <div className={styles.lbl}>Colours</div>
                  <div className={styles.swatchGrid}>
                    {SOLIDS.map((c) => (
                      <button key={c} type="button" className={`${styles.sw} ${bg.solid.toLowerCase() === c.toLowerCase() ? styles.on : ''}`} title={c} style={{ background: c }} onClick={() => set((t) => { t.bg.mode = 'solid'; t.bg.solid = c; t.preset = '' })} />
                    ))}
                    <label className={`${styles.sw} ${styles.custom}`} title="Custom colour">
                      <input type="color" value={bg.solid} onChange={(e) => set((t) => { t.bg.mode = 'solid'; t.bg.solid = e.target.value; t.preset = '' })} />
                    </label>
                  </div>
                </div>
              ) : (
                <div className={styles.mt}>
                  <div className={styles.lbl}>Gradient presets</div>
                  <div className={`${styles.swatchGrid} ${styles.big}`}>
                    {GRADS.map((g) => (
                      <button key={g.n} type="button" className={`${styles.sw} ${bg.mode === 'gradient' && gradCss(bg) === presetCss(g) ? styles.on : ''}`} title={g.n} style={{ background: presetCss(g) }} onClick={() => onChange({ ...loadGrad(theme, g), preset: '' })} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {bg.mode === 'gradient' ? <GradientBuilder theme={theme} set={set} onToast={onToast} /> : null}
          </>
        ) : null}

        {/* ---------- CARDS & CHARTS ---------- */}
        {tab === 'cards' ? (
          <>
            <div className={styles.sec}>
              <div className={styles.secT}>Card style</div>
              <div className={styles.seg}>
                {(['solid', 'frosted', 'glass', 'dark'] as const).map((s) => (
                  <button key={s} type="button" className={theme.card === s ? styles.on : ''} onClick={() => set((t) => { t.card = s; t.preset = '' })}>{s[0].toUpperCase() + s.slice(1)}</button>
                ))}
              </div>
              <div className={`${styles.field} ${styles.mt}`}>
                <label>Corner radius <span className={styles.muted}>{theme.radius}px</span></label>
                <input type="range" min={0} max={24} value={theme.radius} onChange={(e) => set((t) => (t.radius = +e.target.value))} />
              </div>
            </div>

            <div className={styles.sec}>
              <div className={styles.secT}>Chart colours</div>
              <div className={styles.palList}>
                {PALETTES.map((p) => (
                  <button key={p.n} type="button" className={`${styles.pal} ${theme.pal === p.n ? styles.on : ''}`} onClick={() => set((t) => { t.pal = p.n; t.preset = '' })}>
                    <span className={styles.bar} style={{ background: `linear-gradient(90deg,${p.c[0]},${p.g})` }} />
                    {p.n}
                    <span className={styles.dots}>{p.c.map((c, i) => <b key={i} style={{ background: c }} />)}</span>
                  </button>
                ))}
              </div>
              <label className={styles.toggle}>
                Gradient fills on charts
                <input type="checkbox" checked={theme.gradFill} onChange={(e) => set((t) => (t.gradFill = e.target.checked))} />
                <span className={styles.tr} />
              </label>
              <label className={styles.toggle} style={{ marginTop: 0 }}>
                Gradient headline numbers
                <input type="checkbox" checked={theme.gradText} onChange={(e) => set((t) => (t.gradText = e.target.checked))} />
                <span className={styles.tr} />
              </label>
            </div>
          </>
        ) : null}
      </div>

      <div className={styles.foot}>
        <button className={styles.btn} type="button" onClick={() => { onChange(defaultTheme()); onToast('Theme reset to Clean') }}>
          <svg className={styles.ico16} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.7L3 8" /><path d="M3 3v5h5" /></svg>
          Reset
        </button>
        <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={() => { onClose(); onToast('Theme applied') }}>Done</button>
      </div>

      <div style={{ display: 'none' }}>{previewCss}</div>
    </aside>
  )
}

/* ---------- gradient builder ---------- */

function GradientBuilder({ theme, set, onToast }: { theme: Theme; set: (fn: (t: Theme) => void) => void; onToast: (m: string) => void }) {
  const bg = theme.bg
  const linearCss = gradCss({ ...bg, type: 'linear', angle: 90 })
  const cssText = `background: ${gradCss(bg)};`

  const dragStop = (i: number, e: ReactPointerEvent<HTMLSpanElement>) => {
    e.preventDefault()
    const track = e.currentTarget.parentElement as HTMLElement
    const rect = track.getBoundingClientRect()
    const move = (ev: globalThis.PointerEvent) => {
      const p = Math.round(Math.min(100, Math.max(0, ((ev.clientX - rect.left) / rect.width) * 100)))
      set((t) => { t.bg.stops[i].p = p; t.bg.mode = 'gradient'; t.preset = ''; t.activeStop = i })
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    set((t) => (t.activeStop = i))
  }

  const addStop = () => {
    const st = [...bg.stops].sort((a, b) => a.p - b.p)
    let gap = 0, at = 50
    for (let i = 0; i < st.length - 1; i++) if (st[i + 1].p - st[i].p > gap) { gap = st[i + 1].p - st[i].p; at = Math.round((st[i].p + st[i + 1].p) / 2) }
    set((t) => { t.bg.stops.push({ c: '#FFFFFF', p: at }); t.activeStop = t.bg.stops.length - 1; t.bg.mode = 'gradient'; t.preset = '' })
  }

  const setAngle = (a: number) => set((t) => { t.bg.angle = ((Math.round(a) % 360) + 360) % 360; t.bg.mode = 'gradient'; t.preset = '' })

  return (
    <div className={styles.sec}>
      <div className={styles.secT}>Customize gradient</div>
      <div className={styles.gradPreview} style={{ background: linearCss }}>
        <div className={styles.stopsTrack}>
          {bg.stops.map((s, i) => (
            <span key={i} className={`${styles.stopH} ${i === theme.activeStop ? styles.on : ''}`} style={{ left: `${s.p}%`, background: s.c }} title={`${s.c} at ${s.p}%`} onPointerDown={(e) => dragStop(i, e)} />
          ))}
        </div>
      </div>

      <div className={styles.stopList}>
        {bg.stops.map((s, i) => (
          <div key={i} className={styles.stopRow}>
            <label className={styles.sw} style={{ background: s.c }}>
              <input type="color" value={s.c} onChange={(e) => set((t) => { t.bg.stops[i].c = e.target.value; t.bg.mode = 'gradient'; t.preset = ''; t.activeStop = i })} />
            </label>
            <input className={styles.fld} value={s.c.toUpperCase()} maxLength={7} aria-label="Hex colour" onChange={(e) => { const v = e.target.value.trim(); if (/^#?[0-9a-f]{6}$/i.test(v)) set((t) => { t.bg.stops[i].c = v[0] === '#' ? v : '#' + v; t.bg.mode = 'gradient'; t.preset = '' }) }} />
            <div className={styles.pct}>
              <input className={styles.fld} type="number" min={0} max={100} value={s.p} aria-label="Position" onChange={(e) => set((t) => { t.bg.stops[i].p = Math.min(100, Math.max(0, +e.target.value || 0)); t.bg.mode = 'gradient'; t.preset = '' })} />
            </div>
            <button type="button" title="Remove stop" disabled={bg.stops.length <= 2} onClick={() => set((t) => { t.bg.stops.splice(i, 1); t.activeStop = 0 })}>×</button>
          </div>
        ))}
      </div>
      <button className={styles.addStop} type="button" disabled={bg.stops.length >= 5} onClick={addStop}>+ Add colour stop</button>

      <div className={`${styles.field} ${styles.mt}`}>
        <label>Type</label>
        <div className={styles.seg}>
          {(['linear', 'radial', 'conic'] as const).map((v) => (
            <button key={v} type="button" className={bg.type === v ? styles.on : ''} onClick={() => set((t) => { t.bg.type = v; t.bg.mode = 'gradient'; t.preset = '' })}>{v[0].toUpperCase() + v.slice(1)}</button>
          ))}
        </div>
      </div>

      {bg.type !== 'radial' ? (
        <div className={styles.field}>
          <label>Angle</label>
          <div className={styles.angleRow}>
            <button type="button" className={styles.dial} title="Click to set the angle" onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              setAngle((Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180) / Math.PI)
            }}>
              <i className={styles.dialHand} style={{ transform: `rotate(${bg.angle + 180}deg)` }} />
            </button>
            <input type="range" min={0} max={360} step={1} value={bg.angle} onChange={(e) => setAngle(+e.target.value)} />
            <input className={styles.fld} type="number" min={0} max={360} value={bg.angle} style={{ height: 32, padding: '0 8px' }} onChange={(e) => setAngle(+e.target.value)} />
          </div>
        </div>
      ) : null}

      <div className={styles.cssOut}>
        <code>{cssText}</code>
        <button type="button" onClick={() => { navigator.clipboard?.writeText(cssText).then(() => onToast('CSS copied'), () => onToast('Could not copy')) }}>Copy</button>
      </div>
    </div>
  )
}
