import type { Command } from 'commander'
import { findTemplate, templateIds } from '../lib/templates'
import { renderDashboard } from '../lib/renderer'

/** `queryrank render <template>` — render a template to a PNG (or PDF). */
export function registerRender(program: Command): void {
  program
    .command('render')
    .description('Render a dashboard template to an image')
    .argument('<template>', `template id — one of: ${templateIds.join(', ')}`)
    .option('-o, --out <file>', 'output file (default <template>.<format>)')
    .option('-f, --format <format>', 'png or pdf', 'png')
    .option('-t, --theme <name>', 'theme preset, e.g. Aurora, Clean, Forest, Midnight')
    .option('-w, --width <px>', 'dashboard width in pixels', '1200')
    .option('-s, --scale <n>', 'pixel density (2 = retina)', '2')
    .action(async (template: string, opts) => {
      if (!findTemplate(template)) {
        console.error(`Unknown template "${template}". Available: ${templateIds.join(', ')}`)
        process.exitCode = 1
        return
      }
      const format = opts.format === 'pdf' ? 'pdf' : 'png'
      const out = opts.out || `${template}.${format}`
      process.stdout.write(
        `Rendering "${template}"${opts.theme ? ` · ${opts.theme}` : ''} → ${out} … `,
      )
      try {
        await renderDashboard({
          template,
          theme: opts.theme,
          width: Number(opts.width) || 1200,
          scale: Number(opts.scale) || 2,
          format,
          out,
        })
        console.log('✓')
      } catch (err) {
        console.log('✗')
        console.error(err instanceof Error ? err.message : err)
        process.exitCode = 1
      }
    })
}
