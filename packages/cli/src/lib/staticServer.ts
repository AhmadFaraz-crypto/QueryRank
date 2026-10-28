import { readFile, stat } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { extname, join, normalize } from 'node:path'

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
}

export interface StaticServer {
  port: number
  stop: () => Promise<void>
}

/** Serve a built SPA directory with an index.html fallback, on an ephemeral
 *  localhost port — just enough to point a headless browser at. */
export async function serveDir(dir: string): Promise<StaticServer> {
  const server: Server = createServer(async (req, res) => {
    try {
      const path = normalize((req.url || '/').split('?')[0]).replace(/^(\.\.[/\\])+/, '')
      let file = join(dir, path === '/' ? 'index.html' : path)
      try {
        if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
      } catch {
        file = join(dir, 'index.html') // SPA fallback for client routes
      }
      const body = await readFile(file)
      res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream')
      res.end(body)
    } catch {
      res.statusCode = 404
      res.end('not found')
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const addr = server.address()
  const port = typeof addr === 'object' && addr ? addr.port : 0
  return { port, stop: () => new Promise((resolve) => server.close(() => resolve())) }
}
