import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { sign, verify } from 'hono/jwt'
import { env } from './env'

const COOKIE = 'qr_session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export interface SessionPayload {
  sub: string
  email: string
  exp: number
}

export async function setSession(
  c: Context,
  userId: string,
  email: string,
): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE
  const token = await sign({ sub: userId, email, exp }, env.APP_SECRET)
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  })
}

export async function getSession(c: Context): Promise<SessionPayload | null> {
  const token = getCookie(c, COOKIE)
  if (!token) return null
  try {
    return (await verify(token, env.APP_SECRET, 'HS256')) as unknown as SessionPayload
  } catch {
    return null
  }
}

export function clearSession(c: Context): void {
  deleteCookie(c, COOKIE, { path: '/' })
}
