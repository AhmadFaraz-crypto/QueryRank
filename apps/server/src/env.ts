import 'dotenv/config'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const env = {
  DATABASE_URL: required('DATABASE_URL'),
  APP_SECRET: required('APP_SECRET'),
  // Optional access gate. When set, only this email may register / sign in
  // (single-user instance). When unset/empty, signup is OPEN to anyone.
  ALLOWED_EMAIL: process.env.ALLOWED_EMAIL ?? '',
  OAUTH_REDIRECT_BASE: process.env.OAUTH_REDIRECT_BASE ?? 'http://localhost:5173',
  PORT: Number(process.env.PORT ?? 3000),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  // Google OAuth is optional at boot so the server can start for health checks
  // before it's configured. The auth routes guard on `googleConfigured()`.
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  // Transactional email via Resend (https://resend.com), used for the
  // password-reset link. Optional at boot — the reset flow guards on
  // `emailConfigured()` and returns a clear error when it's unset.
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  // The verified sender address Resend sends from, e.g.
  //   "QueryRank <noreply@yourdomain.com>"
  EMAIL_FROM: process.env.EMAIL_FROM,
}

export function googleConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
}

export function emailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM)
}
