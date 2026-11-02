import { integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/** The account(s) allowed to use this instance. Single-user for now. */
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull().default(''),
  avatar: text('avatar'),
  // scrypt hash of the email/password login. Null for accounts that only ever
  // sign in with Google — password login is optional, not required.
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * One-time password-reset links. We store only a SHA-256 hash of the token;
 * the raw token lives only in the email. Rows are single-use (`usedAt`) and
 * short-lived (`expiresAt`, 30 minutes).
 */
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * A connected data source (Google Search Console, GA4, ...). OAuth tokens are
 * stored encrypted at rest — never in plaintext. (Encryption lands with the
 * first real adapter in milestone 2; the column holds the AES-GCM payload.)
 */
export const connections = pgTable('connections', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'gsc' | 'ga4'
  label: text('label').notNull(),
  accountId: text('account_id'),
  encryptedTokens: text('encrypted_tokens').notNull(),
  scopes: text('scopes'),
  status: text('status').notNull().default('connected'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
})

/** A saved dashboard: the block/theme config the designer produces, as JSON. */
export const dashboards = pgTable('dashboards', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  config: jsonb('config').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * An imported GSC/GA4 file export (the no-keys path). The whole normalized
 * dataset (series + breakdowns) is stored as JSON so it renders without a live
 * connection. `id` is the client-generated id, scoped to the user.
 */
export const datasets = pgTable(
  'datasets',
  {
    id: text('id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    source: text('source').notNull(),
    data: jsonb('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.id] }) }),
)

/**
 * A saved SEO audit: the user enters a URL, we fetch and analyze the page, and
 * store the full report (score + checks + extracted facts) as JSON so it can be
 * re-opened and re-exported to PDF without re-running the crawl.
 */
export const seoAudits = pgTable('seo_audits', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  finalUrl: text('final_url').notNull().default(''),
  score: integer('score').notNull().default(0),
  report: jsonb('report').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * A saved whole-site SEO crawl: the aggregated report (average score, per-page
 * results, recurring issues) for a bounded crawl of a site, stored as JSON.
 */
export const siteAudits = pgTable('site_audits', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  site: text('site').notNull(),
  pagesCrawled: integer('pages_crawled').notNull().default(0),
  avgScore: integer('avg_score').notNull().default(0),
  report: jsonb('report').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type User = typeof users.$inferSelect
export type Connection = typeof connections.$inferSelect
export type Dashboard = typeof dashboards.$inferSelect
export type DatasetRow = typeof datasets.$inferSelect
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect
export type SeoAuditRow = typeof seoAudits.$inferSelect
export type SiteAuditRow = typeof siteAudits.$inferSelect
