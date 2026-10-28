/**
 * Dashboard theming. A `Theme` sets the background, card
 * style, corner radius, and chart palette; `themeVars(theme)` turns it into the
 * CSS custom properties the dashboard reads.
 */

export interface Stop {
  c: string
  p: number
}
export interface Bg {
  mode: 'solid' | 'gradient'
  solid: string
  type: 'linear' | 'radial' | 'conic'
  angle: number
  stops: Stop[]
}
export interface Theme {
  bg: Bg
  card: string
  radius: number
  pal: string
  gradFill: boolean
  gradText: boolean
  preset: string
  activeStop: number
}

export interface GradPreset {
  n: string
  type: 'linear' | 'radial' | 'conic'
  angle: number
  stops: Array<[string, number]>
}

export const GRADS: GradPreset[] = [
  { n: 'Coral night', type: 'linear', angle: 145, stops: [['#14123A', 0], ['#1E1B4B', 55], ['#4A2457', 100]] },
  { n: 'Coral glow', type: 'linear', angle: 135, stops: [['#FF6B5B', 0], ['#FFA36C', 100]] },
  { n: 'Paper', type: 'linear', angle: 180, stops: [['#FBFAF7', 0], ['#F1EDE5', 100]] },
  { n: 'Aurora', type: 'linear', angle: 135, stops: [['#6366F1', 0], ['#A855F7', 50], ['#EC4899', 100]] },
  { n: 'Ocean', type: 'linear', angle: 135, stops: [['#0EA5E9', 0], ['#6366F1', 100]] },
  { n: 'Sunset', type: 'linear', angle: 135, stops: [['#F97316', 0], ['#EC4899', 100]] },
  { n: 'Forest', type: 'linear', angle: 135, stops: [['#3F8A34', 0], ['#185A43', 60], ['#0F4A3E', 100]] },
  { n: 'Midnight', type: 'linear', angle: 150, stops: [['#0F172A', 0], ['#312E81', 100]] },
  { n: 'Royal', type: 'linear', angle: 135, stops: [['#1E3A8A', 0], ['#7C3AED', 100]] },
  { n: 'Deep sea', type: 'linear', angle: 160, stops: [['#0B1F3A', 0], ['#0E7490', 100]] },
  { n: 'Ember', type: 'linear', angle: 135, stops: [['#7C2D12', 0], ['#BE185D', 100]] },
  { n: 'Peach', type: 'linear', angle: 135, stops: [['#FFE1C9', 0], ['#FBC2EB', 100]] },
  { n: 'Mint', type: 'linear', angle: 135, stops: [['#D4FC79', 0], ['#96E6A1', 100]] },
  { n: 'Sky', type: 'linear', angle: 135, stops: [['#E0F2FE', 0], ['#EDE9FE', 100]] },
  { n: 'Cotton', type: 'radial', angle: 0, stops: [['#FDF2F8', 0], ['#E0E7FF', 100]] },
  { n: 'Lagoon', type: 'linear', angle: 120, stops: [['#ECFEFF', 0], ['#CCFBF1', 50], ['#E0E7FF', 100]] },
  { n: 'Lemonade', type: 'linear', angle: 135, stops: [['#FEF9C3', 0], ['#FED7AA', 100]] },
  { n: 'Graphite', type: 'linear', angle: 180, stops: [['#1F2937', 0], ['#0B0F17', 100]] },
  { n: 'Neon', type: 'conic', angle: 200, stops: [['#22D3EE', 0], ['#A855F7', 33], ['#EC4899', 66], ['#22D3EE', 100]] },
  { n: 'Rose', type: 'linear', angle: 135, stops: [['#FFE4E6', 0], ['#FDA4AF', 100]] },
  { n: 'Twilight', type: 'linear', angle: 135, stops: [['#312E81', 0], ['#9D174D', 100]] },
]

export const SOLIDS = ['#FFFFFF', '#F8F7F4', '#F1F5F9', '#EEF2FF', '#F5F3FF', '#FDF2F8', '#ECFDF5', '#FFFBEB', '#E2E8F0', '#CBD5E1', '#1E293B', '#0F172A', '#111827', '#1E1B4B', '#052E2B', '#3B0764']

export interface Palette {
  n: string
  c: string[]
  g: string
}
export const PALETTES: Palette[] = [
  { n: 'Coral', c: ['#FF6B5B', '#1E1B4B', '#FDBA74', '#5B54B8', '#2BB3A3', '#F43F5E'], g: '#FFA36C' },
  { n: 'Coral dark', c: ['#FF6B5B', '#A5B4FC', '#FDBA74', '#5EEAD4', '#F9A8D4', '#FDE68A'], g: '#FFA36C' },
  { n: 'Midnight', c: ['#1E1B4B', '#FF6B5B', '#5B54B8', '#FDBA74', '#94A3B8', '#2BB3A3'], g: '#5B54B8' },
  { n: 'Indigo', c: ['#3B5BDB', '#12B5A5', '#F59F00', '#F0624D', '#8B5CF6', '#38BDF8'], g: '#9AA9FF' },
  { n: 'Violet', c: ['#7C3AED', '#EC4899', '#06B6D4', '#F59E0B', '#10B981', '#6366F1'], g: '#E879F9' },
  { n: 'Sunset', c: ['#F97316', '#F43F5E', '#FBBF24', '#A855F7', '#FB7185', '#FDBA74'], g: '#EC4899' },
  { n: 'Ocean', c: ['#0EA5E9', '#14B8A6', '#6366F1', '#22D3EE', '#818CF8', '#2DD4BF'], g: '#6366F1' },
  { n: 'Forest', c: ['#22C55E', '#14B8A6', '#EAB308', '#84CC16', '#10B981', '#A3E635'], g: '#14B8A6' },
  { n: 'Neon', c: ['#22D3EE', '#F472B6', '#A78BFA', '#FACC15', '#34D399', '#FB923C'], g: '#A78BFA' },
  { n: 'Mono', c: ['#334155', '#64748B', '#94A3B8', '#475569', '#1E293B', '#CBD5E1'], g: '#94A3B8' },
]

export interface ThemePreset {
  n: string
  bg: { mode: 'solid'; solid: string } | { mode: 'gradient'; g: string }
  card: string
  pal: string
}
export const THEMES: ThemePreset[] = [
  { n: 'Clean', bg: { mode: 'solid', solid: '#F8F7F4' }, card: 'solid', pal: 'Coral' },
  { n: 'Coral night', bg: { mode: 'gradient', g: 'Coral night' }, card: 'dark', pal: 'Coral dark' },
  { n: 'Aurora', bg: { mode: 'gradient', g: 'Aurora' }, card: 'glass', pal: 'Neon' },
  { n: 'Sunset', bg: { mode: 'gradient', g: 'Sunset' }, card: 'frosted', pal: 'Sunset' },
  { n: 'Ocean', bg: { mode: 'gradient', g: 'Ocean' }, card: 'glass', pal: 'Ocean' },
  { n: 'Forest', bg: { mode: 'gradient', g: 'Forest' }, card: 'dark', pal: 'Forest' },
  { n: 'Midnight', bg: { mode: 'gradient', g: 'Midnight' }, card: 'dark', pal: 'Neon' },
  { n: 'Peach', bg: { mode: 'gradient', g: 'Peach' }, card: 'solid', pal: 'Violet' },
  { n: 'Lagoon', bg: { mode: 'gradient', g: 'Lagoon' }, card: 'frosted', pal: 'Ocean' },
  { n: 'Graphite', bg: { mode: 'gradient', g: 'Graphite' }, card: 'dark', pal: 'Indigo' },
]

interface CardStyle {
  bg: string
  ink: string
  ink2: string
  muted: string
  line: string
  chip: string
  track: string
  blur: string
  shadow: string
  neg: string
  pos: string
}
export const CARD: Record<string, CardStyle> = {
  solid: { bg: '#FFFFFF', ink: '#111827', ink2: '#4B5563', muted: '#8A919E', line: '#E4E8ED', chip: '#F3F5F8', track: '#EAEDF1', blur: 'none', shadow: 'none', neg: '#B42318', pos: '#047857' },
  frosted: { bg: 'rgba(255,255,255,.78)', ink: '#111827', ink2: '#374151', muted: '#6B7280', line: 'rgba(255,255,255,.6)', chip: 'rgba(255,255,255,.7)', track: 'rgba(17,24,39,.08)', blur: 'blur(14px)', shadow: '0 8px 24px rgba(16,24,40,.08)', neg: '#B42318', pos: '#047857' },
  glass: { bg: 'rgba(255,255,255,.14)', ink: '#FFFFFF', ink2: 'rgba(255,255,255,.85)', muted: 'rgba(255,255,255,.68)', line: 'rgba(255,255,255,.22)', chip: 'rgba(255,255,255,.12)', track: 'rgba(255,255,255,.16)', blur: 'blur(16px)', shadow: '0 8px 30px rgba(0,0,0,.12)', neg: '#FFB4B6', pos: '#34D399' },
  dark: { bg: 'rgba(10,14,26,.62)', ink: '#F3F4F6', ink2: '#D1D5DB', muted: '#9CA3AF', line: 'rgba(255,255,255,.08)', chip: 'rgba(255,255,255,.06)', track: 'rgba(255,255,255,.1)', blur: 'blur(10px)', shadow: '0 8px 30px rgba(0,0,0,.25)', neg: '#FF9EA1', pos: '#34D399' },
}

/* ---------- helpers ---------- */
function hexRgb(h: string) {
  h = h.replace('#', '')
  if (h.length === 3) h = h.split('').map((x) => x + x).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export function lum(h: string) {
  const [r, g, b] = hexRgb(h).map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function gradCss(bg: Bg): string {
  const st = [...bg.stops].sort((a, b) => a.p - b.p).map((s) => `${s.c} ${s.p}%`).join(', ')
  return bg.type === 'radial'
    ? `radial-gradient(circle at 30% 20%, ${st})`
    : bg.type === 'conic'
      ? `conic-gradient(from ${bg.angle}deg at 50% 50%, ${st})`
      : `linear-gradient(${bg.angle}deg, ${st})`
}
export function presetCss(g: GradPreset): string {
  return gradCss({ mode: 'gradient', solid: '#fff', type: g.type, angle: g.angle, stops: g.stops.map(([c, p]) => ({ c, p })) })
}
function bgIsDark(bg: Bg): boolean {
  return bg.mode === 'solid' ? lum(bg.solid) < 0.35 : bg.stops.reduce((s, x) => s + lum(x.c), 0) / bg.stops.length < 0.35
}
export function cardVars(style: string): Record<string, string> {
  const s = CARD[style]
  return { '--card-bg': s.bg, '--card-ink': s.ink, '--card-ink-2': s.ink2, '--card-muted': s.muted, '--card-line': s.line, '--card-chip': s.chip, '--track': s.track, '--card-blur': s.blur, '--card-shadow': s.shadow, '--neg-ink': s.neg, '--pos-ink': s.pos }
}

/** The CSS custom properties for a theme, applied to the dashboard element. */
export function themeVars(theme: Theme): Record<string, string> {
  const bg = theme.bg
  const dark = bgIsDark(bg)
  const bgCss = bg.mode === 'solid' ? bg.solid : gradCss(bg)
  const pal = PALETTES.find((p) => p.n === theme.pal) ?? PALETTES[0]
  const glassLight =
    theme.card === 'glass' && !dark
      ? { '--card-bg': 'rgba(255,255,255,.3)', '--card-ink': '#111827', '--card-ink-2': '#374151', '--card-muted': '#4B5563', '--card-line': 'rgba(255,255,255,.55)', '--card-chip': 'rgba(255,255,255,.4)', '--track': 'rgba(17,24,39,.1)', '--neg-ink': '#B42318', '--pos-ink': '#047857' }
      : {}
  return {
    '--dash-bg': bgCss,
    '--head-ink': dark ? '#FFFFFF' : '#111827',
    '--head-muted': dark ? 'rgba(255,255,255,.72)' : '#6B7280',
    '--head-chip': dark ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.85)',
    '--head-chip-line': dark ? 'rgba(255,255,255,.22)' : '#E5E7EB',
    '--head-on': dark ? '#111827' : '#FFFFFF',
    '--card-radius': theme.radius + 'px',
    ...cardVars(theme.card),
    ...glassLight,
    ...Object.fromEntries(pal.c.map((c, i) => ['--c' + (i + 1), c])),
    '--g1': theme.gradFill ? pal.g : pal.c[0],
  } as Record<string, string>
}

/** The default "Clean" theme. */
export function defaultTheme(): Theme {
  return {
    bg: { mode: 'solid', solid: '#F8F7F4', type: 'linear', angle: 135, stops: [{ c: '#6366F1', p: 0 }, { c: '#A855F7', p: 50 }, { c: '#EC4899', p: 100 }] },
    card: 'solid', radius: 12, pal: 'Coral', gradFill: true, gradText: false, preset: 'Clean', activeStop: 0,
  }
}

/** Loads a gradient preset's stops into a bg (keeping it a gradient). */
export function loadGrad(theme: Theme, g: GradPreset): Theme {
  return { ...theme, bg: { ...theme.bg, mode: 'gradient', type: g.type, angle: g.angle, stops: g.stops.map(([c, p]) => ({ c, p })) }, activeStop: 0 }
}

/** The background CSS for a theme (solid or gradient). */
export function themeBg(theme: Theme): string {
  return theme.bg.mode === 'solid' ? theme.bg.solid : gradCss(theme.bg)
}

/** A full Theme for a named preset. */
export function presetTheme(name: string): Theme {
  return applyPreset(defaultTheme(), THEMES.find((t) => t.n === name) ?? THEMES[0])
}

/** CSS variables for a named theme preset. */
export function presetThemeVars(name: string): Record<string, string> {
  return themeVars(presetTheme(name))
}

/** Background CSS for a named theme preset. */
export function presetBg(name: string): string {
  return themeBg(presetTheme(name))
}

/** Applies a ready-made theme preset. */
export function applyPreset(theme: Theme, t: ThemePreset): Theme {
  const next: Theme = { ...theme, preset: t.n, card: t.card, pal: t.pal }
  const tb = t.bg
  if (tb.mode === 'solid') {
    return { ...next, bg: { ...next.bg, mode: 'solid', solid: tb.solid } }
  }
  const g = GRADS.find((x) => x.n === tb.g)
  return g ? loadGrad(next, g) : next
}
