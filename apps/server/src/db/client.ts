import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../env'
import * as schema from './schema'
import { pgConnection } from './socket'

const conn = pgConnection(env.DATABASE_URL)
const client = postgres(conn.url, conn.options)

export const db = drizzle(client, { schema })
