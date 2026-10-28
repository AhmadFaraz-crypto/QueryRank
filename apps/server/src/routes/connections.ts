import { randomBytes } from 'node:crypto'
import {
  GA4_SCOPE,
  GSC_SCOPE,
  ga4ListProperties,
  gscListSites,
} from '@queryrank/adapters'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { buildAuthUrl, exchangeCode } from '../auth/google'
import { db } from '../db/client'
import { connections, type Connection } from '../db/schema'
import { env, googleConfigured } from '../env'
import { ga4Overview } from '../ga4/service'
import { gscOverview } from '../gsc/service'
import { getFreshAccessToken, packTokens } from '../tokens'
import { getSession } from '../session'

const CONN_STATE = 'qr_conn_state'
const callbackUri = () => `${env.OAUTH_REDIRECT_BASE}/api/connections/google/callback`

type Provider = 'gsc' | 'ga4'
const SCOPES: Record<Provider, string> = { gsc: GSC_SCOPE, ga4: GA4_SCOPE }
const LABELS: Record<Provider, string> = {
  gsc: 'Google Search Console',
  ga4: 'Google Analytics 4',
}

export const connectionsRouter = new Hono<{ Variables: { userId: string } }>()

// Every connections route requires a signed-in user.
connectionsRouter.use('*', async (c, next) => {
  const session = await getSession(c)
  if (!session) return c.json({ error: 'unauthorized' }, 401)
  c.set('userId', session.sub)
  await next()
})

async function owned(userId: string, id: string): Promise<Connection | null> {
  const rows = await db
    .select()
    .from(connections)
    .where(and(eq(connections.id, id), eq(connections.userId, userId)))
    .limit(1)
  return rows[0] ?? null
}

// List the user's connections (never exposes tokens).
connectionsRouter.get('/', async (c) => {
  const rows = await db
    .select()
    .from(connections)
    .where(eq(connections.userId, c.get('userId')))
  return c.json(
    rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      label: r.label,
      status: r.status,
      accountId: r.accountId,
      lastSyncAt: r.lastSyncAt,
    })),
  )
})

// Start a Google OAuth grant for a provider (?provider=gsc|ga4), offline for a
// refresh token. The provider rides through the redirect inside `state`, so a
// single registered redirect URI serves every Google source.
connectionsRouter.get('/google/authorize', (c) => {
  if (!googleConfigured())
    return c.json({ error: 'Google OAuth is not configured.' }, 500)
  const provider: Provider = c.req.query('provider') === 'ga4' ? 'ga4' : 'gsc'
  const nonce = randomBytes(16).toString('hex')
  setCookie(c, CONN_STATE, nonce, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  })
  return c.redirect(
    buildAuthUrl({
      clientId: env.GOOGLE_CLIENT_ID as string,
      redirectUri: callbackUri(),
      state: `${provider}.${nonce}`,
      scopes: [SCOPES[provider]],
    }),
  )
})

connectionsRouter.get('/google/callback', async (c) => {
  const url = new URL(c.req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') ?? ''
  const saved = getCookie(c, CONN_STATE)
  deleteCookie(c, CONN_STATE, { path: '/' })
  const [provider, nonce] = state.split('.') as [Provider, string]
  if (!code || !nonce || nonce !== saved || (provider !== 'gsc' && provider !== 'ga4')) {
    return c.redirect(`${env.OAUTH_REDIRECT_BASE}/data?connect=error`)
  }
  try {
    const tokens = await exchangeCode({
      clientId: env.GOOGLE_CLIENT_ID as string,
      clientSecret: env.GOOGLE_CLIENT_SECRET as string,
      code,
      redirectUri: callbackUri(),
    })
    await db.insert(connections).values({
      userId: c.get('userId'),
      provider,
      label: LABELS[provider],
      encryptedTokens: packTokens(tokens),
      scopes: tokens.scope ?? SCOPES[provider],
      status: 'connected',
    })
    return c.redirect(`${env.OAUTH_REDIRECT_BASE}/data?connect=${provider}`)
  } catch (err) {
    console.error('Connection callback failed:', err)
    return c.redirect(`${env.OAUTH_REDIRECT_BASE}/data?connect=error`)
  }
})

connectionsRouter.delete('/:id', async (c) => {
  await db
    .delete(connections)
    .where(
      and(eq(connections.id, c.req.param('id')), eq(connections.userId, c.get('userId'))),
    )
  return c.json({ ok: true })
})

// Search Console properties the connected account can access.
connectionsRouter.get('/:id/sites', async (c) => {
  const conn = await owned(c.get('userId'), c.req.param('id'))
  if (!conn) return c.json({ error: 'not found' }, 404)
  try {
    const token = await getFreshAccessToken(conn)
    return c.json(await gscListSites(token))
  } catch (err) {
    console.error('listSites failed:', err)
    return c.json({ error: 'fetch_failed' }, 502)
  }
})

// GA4 properties the connected account can access.
connectionsRouter.get('/:id/properties', async (c) => {
  const conn = await owned(c.get('userId'), c.req.param('id'))
  if (!conn) return c.json({ error: 'not found' }, 404)
  try {
    const token = await getFreshAccessToken(conn)
    return c.json(await ga4ListProperties(token))
  } catch (err) {
    console.error('listProperties failed:', err)
    return c.json({ error: 'fetch_failed' }, 502)
  }
})

// Live data over the last `?days=` days (default 28, clamped 1–730). GSC takes
// ?site=, GA4 takes ?property=.
connectionsRouter.get('/:id/overview', async (c) => {
  const conn = await owned(c.get('userId'), c.req.param('id'))
  if (!conn) return c.json({ error: 'not found' }, 404)
  const parsedDays = Number.parseInt(c.req.query('days') ?? '', 10)
  const days = Number.isFinite(parsedDays) ? Math.min(730, Math.max(1, parsedDays)) : 28
  try {
    const token = await getFreshAccessToken(conn)
    let data
    if (conn.provider === 'ga4') {
      const property = c.req.query('property')
      if (!property) return c.json({ error: 'property query param required' }, 400)
      data = await ga4Overview(token, property, days)
    } else {
      const site = c.req.query('site')
      if (!site) return c.json({ error: 'site query param required' }, 400)
      data = await gscOverview(token, site, days)
    }
    await db
      .update(connections)
      .set({ lastSyncAt: new Date() })
      .where(eq(connections.id, conn.id))
    return c.json(data)
  } catch (err) {
    console.error('overview failed:', err)
    return c.json({ error: 'fetch_failed' }, 502)
  }
})
