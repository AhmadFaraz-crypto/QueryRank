import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { serveDir } from './staticServer'

const HERE = dirname(fileURLToPath(import.meta.url))
/** The built SPA the headless browser loads the /render page from. */
const DIST = resolve(HERE, '../../../../apps/playground/dist')

// We use puppeteer-core (no bundled Chromium) + an installed browser, so the CLI
// stays light. Override with PUPPETEER_EXECUTABLE_PATH if yours isn't found.
const CHROME_PATHS = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
].filter((p): p is string => Boolean(p))

export interface RenderOptions {
  template: string
  theme?: string
  width: number
  scale: number
  format: 'png' | 'pdf'
  out: string
}

export async function renderDashboard(o: RenderOptions): Promise<void> {
  if (!existsSync(DIST))
    throw new Error(
      `Built UI not found at ${DIST}.\n  Build it first:  pnpm --filter @queryrank/playground build`,
    )
  const executablePath = CHROME_PATHS.find((p) => existsSync(p))
  if (!executablePath)
    throw new Error(
      'Could not find Chrome/Chromium. Install one, or set PUPPETEER_EXECUTABLE_PATH to its path.',
    )

  const srv = await serveDir(DIST)
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--hide-scrollbars'],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: o.width + 80, height: 1600, deviceScaleFactor: o.scale })
    const qs = new URLSearchParams({ template: o.template, width: String(o.width) })
    if (o.theme) qs.set('theme', o.theme)
    await page.goto(`http://127.0.0.1:${srv.port}/render?${qs.toString()}`, {
      waitUntil: 'networkidle0',
    })
    // The render page flags itself ready once the charts have settled.
    await page.waitForSelector('body[data-render-ready]', { timeout: 15000 })

    if (o.format === 'pdf') {
      await page.pdf({ path: o.out, printBackground: true, width: `${o.width + 72}px`, height: '1400px' })
    } else {
      const el = await page.$('.static-dash')
      if (!el) throw new Error('Could not find the rendered dashboard on the page.')
      await el.screenshot({ path: o.out })
    }
  } finally {
    await browser.close()
    await srv.stop()
  }
}
