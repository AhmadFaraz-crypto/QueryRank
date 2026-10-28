import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { env } from './env'

// 256-bit key derived from APP_SECRET. The salt is fixed so the same secret
// always yields the same key (otherwise stored tokens couldn't be decrypted).
const key = scryptSync(env.APP_SECRET, 'queryrank-token-enc-v1', 32)

/**
 * Encrypt a string with AES-256-GCM. Output is base64 of iv(12) + tag(16) +
 * ciphertext — safe to store in the database. Decryptable only with APP_SECRET.
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}
