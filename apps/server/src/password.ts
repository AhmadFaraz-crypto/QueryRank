import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

// Password hashing with scrypt (Node built-in — no external dependency, same
// spirit as crypto.ts). Stored form is "salt:hash" in hex.

const scryptAsync = promisify(scrypt)
const KEYLEN = 32

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer
  return `${salt.toString('hex')}:${derived.toString('hex')}`
}

/** Constant-time verify. Returns false for any malformed stored value. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const derived = (await scryptAsync(password, Buffer.from(saltHex, 'hex'), KEYLEN)) as Buffer
  return expected.length === derived.length && timingSafeEqual(expected, derived)
}

/** Shared server-side password policy, matched by the register/reset UI. */
export const MIN_PASSWORD = 8
