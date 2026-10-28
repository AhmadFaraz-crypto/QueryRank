import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { buildAuthUrl, exchangeCode, fetchUserInfo } from '../auth/google'
import { db } from '../db/client'
import { passwordResetTokens, users } from '../db/schema'
import { sendPasswordResetEmail } from '../email'
import { env, emailConfigured, googleConfigured } from '../env'
import { hashPassword, MIN_PASSWORD, verifyPassword } from '../password'
import { clearSession, getSession, setSession } from '../session'

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

const LOGIN_SCOPES = ['openid', 'email', 'profile']
const STATE_COOKIE = 'qr_oauth_state'
const redirectUri = () => `${env.OAUTH_REDIRECT_BASE}/api/auth/google/callback`

export const auth = new Hono()

// Kick off the Google sign-in flow.
auth.get('/google', (c) => {
  if (!googleConfigured()) {
    return c.json({ error: 'Google OAuth is not configured on this server.' }, 500)
  }
  const state = randomBytes(16).toString('hex')
  setCookie(c, STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  })
  return c.redirect(
    buildAuthUrl({
      clientId: env.GOOGLE_CLIENT_ID as string,
      redirectUri: redirectUri(),
      state,
      scopes: LOGIN_SCOPES,
    }),
  )
})

// Google redirects back here with an authorization code.
auth.get('/google/callback', async (c) => {
  const url = new URL(c.req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const savedState = getCookie(c, STATE_COOKIE)
  deleteCookie(c, STATE_COOKIE, { path: '/' })

  if (!code || !state || state !== savedState) {
    return c.redirect(`${env.OAUTH_REDIRECT_BASE}/?auth=error`)
  }

  try {
    const tokens = await exchangeCode({
      clientId: env.GOOGLE_CLIENT_ID as string,
      clientSecret: env.GOOGLE_CLIENT_SECRET as string,
      code,
      redirectUri: redirectUri(),
    })
    const info = await fetchUserInfo(tokens.access_token)
    const email = (info.email ?? '').toLowerCase()

    // Single-user gate: only the configured owner may enter.
    if (!email || email !== env.ALLOWED_EMAIL.toLowerCase()) {
      return c.redirect(`${env.OAUTH_REDIRECT_BASE}/?auth=forbidden`)
    }

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)
    let user = existing[0]
    if (!user) {
      const inserted = await db
        .insert(users)
        .values({ email, name: info.name ?? '', avatar: info.picture ?? null })
        .returning()
      user = inserted[0]
    } else {
      await db
        .update(users)
        .set({ name: info.name ?? user.name, avatar: info.picture ?? user.avatar })
        .where(eq(users.id, user.id))
    }

    await setSession(c, user.id, email)
    return c.redirect(`${env.OAUTH_REDIRECT_BASE}/home`)
  } catch (err) {
    console.error('OAuth callback failed:', err)
    return c.redirect(`${env.OAUTH_REDIRECT_BASE}/?auth=error`)
  }
})

auth.post('/logout', (c) => {
  clearSession(c)
  return c.json({ ok: true })
})

// --- Email + password ------------------------------------------------------
// Optional alongside Google. This is a single-user instance, so only the
// configured owner (ALLOWED_EMAIL) may create the password account.

auth.post('/register', async (c) => {
  const { name, email, password } = (await c.req.json().catch(() => ({}))) as {
    name?: string
    email?: string
    password?: string
  }
  const em = String(email ?? '').trim().toLowerCase()
  if (!emailRe.test(em)) return c.json({ error: 'Enter a valid email address.' }, 400)
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    return c.json({ error: `Password must be at least ${MIN_PASSWORD} characters.` }, 400)
  }
  if (em !== env.ALLOWED_EMAIL.toLowerCase()) {
    return c.json({ error: 'This instance is restricted to its owner’s email.' }, 403)
  }

  const existing = (await db.select().from(users).where(eq(users.email, em)).limit(1))[0]
  if (existing?.passwordHash) {
    return c.json({ error: 'An account already exists — sign in instead.' }, 409)
  }

  const passwordHash = await hashPassword(password)
  const nm = String(name ?? '').trim()
  let user = existing
  if (user) {
    // A Google-only account adding a password.
    user = (
      await db
        .update(users)
        .set({ passwordHash, name: nm || user.name })
        .where(eq(users.id, user.id))
        .returning()
    )[0]
  } else {
    user = (await db.insert(users).values({ email: em, name: nm, passwordHash }).returning())[0]
  }

  await setSession(c, user.id, user.email)
  return c.json({ id: user.id, email: user.email, name: user.name })
})

auth.post('/login', async (c) => {
  const { email, password } = (await c.req.json().catch(() => ({}))) as {
    email?: string
    password?: string
  }
  const em = String(email ?? '').trim().toLowerCase()
  const user = (await db.select().from(users).where(eq(users.email, em)).limit(1))[0]
  const ok =
    user?.passwordHash && typeof password === 'string'
      ? await verifyPassword(password, user.passwordHash)
      : false
  if (!user || !ok) return c.json({ error: 'Incorrect email or password.' }, 401)

  await setSession(c, user.id, user.email)
  return c.json({ id: user.id, email: user.email, name: user.name })
})

// Forgot: always answers the same way, so it never reveals whether an account
// exists. When the email matches a user, a one-time link is emailed.
auth.post('/password/request', async (c) => {
  const { email } = (await c.req.json().catch(() => ({}))) as { email?: string }
  const em = String(email ?? '').trim().toLowerCase()
  const user = em
    ? (await db.select().from(users).where(eq(users.email, em)).limit(1))[0]
    : undefined

  if (user) {
    const token = randomBytes(32).toString('hex')
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    })
    const resetUrl = `${env.OAUTH_REDIRECT_BASE}/reset?token=${token}`
    if (emailConfigured()) {
      try {
        await sendPasswordResetEmail(user.email, resetUrl)
      } catch (err) {
        console.error('Failed to send password-reset email:', err)
      }
    } else {
      console.warn('[password-reset] RESEND_API_KEY/EMAIL_FROM not set — cannot send email.')
      if (env.NODE_ENV !== 'production') console.warn(`[password-reset] dev link: ${resetUrl}`)
    }
  }

  return c.json({ ok: true })
})

auth.post('/password/reset', async (c) => {
  const { token, password } = (await c.req.json().catch(() => ({}))) as {
    token?: string
    password?: string
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    return c.json({ error: `Password must be at least ${MIN_PASSWORD} characters.` }, 400)
  }
  if (typeof token !== 'string' || !token) {
    return c.json({ error: 'This reset link is invalid.' }, 400)
  }

  const row = (
    await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, sha256(token)))
      .limit(1)
  )[0]
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    return c.json({ error: 'This reset link has expired or already been used.' }, 400)
  }

  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, row.userId))
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id))
  return c.json({ ok: true })
})

auth.get('/me', async (c) => {
  const session = await getSession(c)
  if (!session) return c.json({ error: 'unauthorized' }, 401)
  const rows = await db.select().from(users).where(eq(users.id, session.sub)).limit(1)
  const user = rows[0]
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  return c.json({ id: user.id, email: user.email, name: user.name, avatar: user.avatar })
})
