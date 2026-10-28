import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { pgConnection } from './socket'

const migrationsFolder = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'drizzle',
)

/**
 * Create the target database if it doesn't exist yet, so the only thing a
 * self-hoster needs is a running Postgres — not a pre-created database.
 *
 * Connects to the target first; only if it reports "database does not exist"
 * (SQLSTATE 3D000) do we connect to the `postgres` maintenance DB and create
 * it. Requires the role to have CREATEDB — callers should surface a friendly
 * "create it manually" hint if this throws.
 */
export async function ensureDatabase(databaseUrl: string): Promise<void> {
  const { url, options } = pgConnection(databaseUrl)
  const dbName = new URL(url).pathname.replace(/^\//, '')
  if (!dbName) throw new Error('DATABASE_URL has no database name')

  const probe = postgres(url, { max: 1, onnotice: () => {}, ...options })
  try {
    await probe`select 1`
    return // database exists — nothing to do
  } catch (err) {
    if ((err as { code?: string }).code !== '3D000') throw err
  } finally {
    await probe.end({ timeout: 5 }).catch(() => {})
  }

  const adminUrl = new URL(url)
  adminUrl.pathname = '/postgres'
  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {}, ...options })
  try {
    const exists = await admin`select 1 from pg_database where datname = ${dbName}`
    if (exists.length === 0) {
      // Identifiers can't be parameterized; dbName is ours but validate anyway.
      if (!/^[A-Za-z0-9_]+$/.test(dbName))
        throw new Error(`Unsafe database name: ${dbName}`)
      await admin.unsafe(`create database "${dbName}"`)
      console.log(`Created database "${dbName}".`)
    }
  } finally {
    await admin.end({ timeout: 5 }).catch(() => {})
  }
}

/** Apply any pending Drizzle migrations (creates/updates tables on boot). */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const { url, options } = pgConnection(databaseUrl)
  const sql = postgres(url, { max: 1, onnotice: () => {}, ...options })
  try {
    await migrate(drizzle(sql), { migrationsFolder })
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {})
  }
}
