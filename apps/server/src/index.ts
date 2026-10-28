import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { ensureDatabase, runMigrations } from './db/bootstrap'
import { env, googleConfigured } from './env'
import { auth } from './routes/auth'
import { connectionsRouter } from './routes/connections'
import { dashboardsRouter } from './routes/dashboards'
import { datasetsRouter } from './routes/datasets'

// Bring the database up to date before serving: create it if missing, then
// apply migrations. The only prerequisite is a running Postgres.
try {
  await ensureDatabase(env.DATABASE_URL)
  await runMigrations(env.DATABASE_URL)
} catch (err) {
  console.error('Database bootstrap failed:', err)
  console.error(
    'Make sure Postgres is running and DATABASE_URL is correct. If the role cannot\n' +
      'create databases, create it once manually (e.g. `createdb queryrank`) and retry.',
  )
  process.exit(1)
}

const app = new Hono()

app.get('/api/health', (c) =>
  c.json({ ok: true, service: 'queryrank-server', googleConfigured: googleConfigured() }),
)

app.route('/api/auth', auth)
app.route('/api/connections', connectionsRouter)
app.route('/api/dashboards', dashboardsRouter)
app.route('/api/datasets', datasetsRouter)

// Any unmatched /api path stays a JSON 404 (never the SPA shell).
app.all('/api/*', (c) => c.json({ error: 'not found' }, 404))

// In production the server also serves the built SPA, so the whole app runs from
// a single container/origin (`docker compose up`). In development the Vite dev
// server serves the UI instead and proxies /api here, so this stays off.
if (env.NODE_ENV === 'production') {
  const root = process.env.STATIC_DIR ?? '../playground/dist'
  app.use('/*', serveStatic({ root }))
  // SPA fallback: client-side routes (/home, /dashboards…) return index.html.
  app.get('/*', serveStatic({ path: `${root}/index.html` }))
}

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`QueryRank server listening on http://localhost:${info.port}`)
  if (!googleConfigured()) {
    console.warn(
      '⚠  Google OAuth not configured — set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env',
    )
  }
})
