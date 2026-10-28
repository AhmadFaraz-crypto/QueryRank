import type { Command } from 'commander'
import { templates } from '../lib/templates'

/** `queryrank templates` — list the dashboard templates available to render. */
export function registerTemplates(program: Command): void {
  program
    .command('templates')
    .description('List the dashboard templates you can render')
    .action(() => {
      const w = Math.max(...templates.map((t) => t.id.length))
      console.log('\nAvailable templates:\n')
      for (const t of templates)
        console.log(`  ${t.id.padEnd(w)}   ${t.name}  ·  ${t.category} · ${t.theme}`)
      console.log('\nRender one:   queryrank render <id> -o out.png\n')
    })
}
