import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'

/**
 * Exports a dashboard element exactly as it looks on screen to a PNG or PDF.
 * The canvas node is CSS-scaled to fit the editor, so we capture it at its
 * native width with the scale transform removed, at 2× for a crisp result.
 */

function slug(name: string): string {
  return (name || 'dashboard').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dashboard'
}

async function capture(node: HTMLElement): Promise<{ dataUrl: string; w: number; h: number }> {
  // offsetWidth/Height are the native layout size (unaffected by the CSS scale).
  const w = node.offsetWidth
  const h = node.offsetHeight
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    width: w,
    height: h,
    // Neutralise the editor's fit-to-width transform so we render at 1:1.
    style: { transform: 'none', left: '0', top: '0', margin: '0' },
    cacheBust: true,
  })
  return { dataUrl, w, h }
}

function download(href: string, filename: string): void {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export async function exportDashboardPng(node: HTMLElement, name: string): Promise<void> {
  const { dataUrl } = await capture(node)
  download(dataUrl, `${slug(name)}.png`)
}

export async function exportDashboardPdf(node: HTMLElement, name: string): Promise<void> {
  const { dataUrl, w, h } = await capture(node)
  // One page sized to the dashboard so the image fills it with no distortion.
  const pdf = new jsPDF({
    orientation: w >= h ? 'landscape' : 'portrait',
    unit: 'px',
    format: [w, h],
    compress: true,
  })
  pdf.addImage(dataUrl, 'PNG', 0, 0, w, h)
  pdf.save(`${slug(name)}.pdf`)
}
