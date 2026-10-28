#!/usr/bin/env -S npx tsx
import { createProgram } from './program'
import { registerTemplates } from './commands/templates'
import { registerRender } from './commands/render'

// The command registry. To add a command: create a file under ./commands that
// exports a `register(program)` function, then add one line here.
const COMMANDS = [registerTemplates, registerRender]

const program = createProgram()
for (const register of COMMANDS) register(program)

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
