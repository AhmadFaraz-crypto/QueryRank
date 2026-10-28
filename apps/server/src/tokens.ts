import { eq } from 'drizzle-orm'
import { refreshAccessToken } from './auth/google'
import { encrypt, decrypt } from './crypto'
import { db } from './db/client'
import { connections, type Connection } from './db/schema'
import { env } from './env'

// OAuth token storage + refresh, shared by every Google adapter (GSC, GA4, …).
// Tokens live encrypted in the connection row; this is the only place they're
// decrypted and refreshed.

interface StoredTokens {
  access_token: string
  refresh_token: string
  scope: string
  expiry: number // epoch ms
}

export function packTokens(t: {
  access_token: string
  refresh_token?: string
  scope?: string
  expires_in: number
}): string {
  const stored: StoredTokens = {
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? '',
    scope: t.scope ?? '',
    expiry: Date.now() + t.expires_in * 1000,
  }
  return encrypt(JSON.stringify(stored))
}

/** Return a valid access token for a connection, refreshing & re-storing if stale. */
export async function getFreshAccessToken(conn: Connection): Promise<string> {
  const tokens = JSON.parse(decrypt(conn.encryptedTokens)) as StoredTokens
  if (Date.now() < tokens.expiry - 60_000) return tokens.access_token
  if (!tokens.refresh_token) {
    throw new Error('No refresh token on this connection — reconnect the source.')
  }
  const refreshed = await refreshAccessToken({
    clientId: env.GOOGLE_CLIENT_ID as string,
    clientSecret: env.GOOGLE_CLIENT_SECRET as string,
    refreshToken: tokens.refresh_token,
  })
  const updated: StoredTokens = {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? tokens.refresh_token,
    scope: refreshed.scope ?? tokens.scope,
    expiry: Date.now() + refreshed.expires_in * 1000,
  }
  await db
    .update(connections)
    .set({ encryptedTokens: encrypt(JSON.stringify(updated)) })
    .where(eq(connections.id, conn.id))
  return updated.access_token
}
