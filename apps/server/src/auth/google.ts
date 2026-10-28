// Minimal Google OAuth 2.0 (authorization-code) helpers. Kept dependency-free
// and explicit so self-hosters can audit exactly what leaves their server.

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo'

export function buildAuthUrl(o: {
  clientId: string
  redirectUri: string
  state: string
  scopes: string[]
}): string {
  const params = new URLSearchParams({
    client_id: o.clientId,
    redirect_uri: o.redirectUri,
    response_type: 'code',
    scope: o.scopes.join(' '),
    state: o.state,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

export interface GoogleTokens {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
  id_token?: string
}

export async function exchangeCode(o: {
  clientId: string
  clientSecret: string
  code: string
  redirectUri: string
}): Promise<GoogleTokens> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: o.clientId,
      client_secret: o.clientSecret,
      code: o.code,
      grant_type: 'authorization_code',
      redirect_uri: o.redirectUri,
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as GoogleTokens
}

export async function refreshAccessToken(o: {
  clientId: string
  clientSecret: string
  refreshToken: string
}): Promise<GoogleTokens> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: o.clientId,
      client_secret: o.clientSecret,
      refresh_token: o.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as GoogleTokens
}

export interface GoogleUserInfo {
  sub: string
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
}

export async function fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Userinfo request failed: ${res.status}`)
  return (await res.json()) as GoogleUserInfo
}
