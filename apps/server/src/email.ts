// Transactional email via Resend's REST API. Kept dependency-free (no SDK) so
// self-hosters can audit exactly what leaves their server, mirroring auth/google.ts.

import { env, emailConfigured } from './env'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export interface SendEmailInput {
  to: string
  subject: string
  html: string
  text?: string
}

/**
 * Sends one email through Resend. Throws if email isn't configured (callers
 * should check `emailConfigured()` first) or if Resend rejects the request.
 */
export async function sendEmail(msg: SendEmailInput): Promise<void> {
  if (!emailConfigured()) {
    throw new Error('Email is not configured: set RESEND_API_KEY and EMAIL_FROM')
  }
  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      ...(msg.text ? { text: msg.text } : {}),
    }),
  })
  if (!res.ok) {
    throw new Error(`Resend request failed: ${res.status} ${await res.text()}`)
  }
}

/** Builds and sends the password-reset email containing a one-time link. */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Reset your QueryRank password',
    text:
      `Reset your QueryRank password using the link below. ` +
      `It expires in 30 minutes.\n\n${resetUrl}\n\n` +
      `If you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#171a1f">
        <h1 style="font-size:20px;margin:0 0 12px">Reset your password</h1>
        <p style="font-size:14px;line-height:1.5;color:#52565e;margin:0 0 20px">
          Click the button below to set a new password. This link expires in 30 minutes.
        </p>
        <a href="${resetUrl}" style="display:inline-block;background:#272c35;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:8px">
          Reset password
        </a>
        <p style="font-size:12.5px;line-height:1.5;color:#8a8f98;margin:24px 0 0">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `.trim(),
  })
}
