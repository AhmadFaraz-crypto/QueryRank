import { Command } from 'commander'

/** The root `queryrank` program. Commands register themselves onto it. */
export function createProgram(): Command {
  const program = new Command()
  program
    .name('queryrank')
    .description('QueryRank command line — render dashboard templates to images, and more.')
    .version('0.0.0', '-v, --version')
    .showHelpAfterError()
  return program
}
