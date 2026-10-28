import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/client'
import { dashboards } from '../db/schema'
import { getSession } from '../session'

export const dashboardsRouter = new Hono<{ Variables: { userId: string } }>()

// All dashboard routes require a signed-in user; rows are always user-scoped.
dashboardsRouter.use('*', async (c, next) => {
  const session = await getSession(c)
  if (!session) return c.json({ error: 'unauthorized' }, 401)
  c.set('userId', session.sub)
  await next()
})

type Row = typeof dashboards.$inferSelect
const view = (r: Row) => ({
  id: r.id,
  name: r.name,
  config: r.config,
  updatedAt: r.updatedAt,
})

dashboardsRouter.get('/', async (c) => {
  const rows = await db
    .select()
    .from(dashboards)
    .where(eq(dashboards.userId, c.get('userId')))
    .orderBy(desc(dashboards.updatedAt))
  return c.json(rows.map(view))
})

dashboardsRouter.post('/', async (c) => {
  const body = await c.req.json<{ name?: string; config?: unknown }>()
  const inserted = await db
    .insert(dashboards)
    .values({
      userId: c.get('userId'),
      name: (body.name ?? 'Untitled dashboard').toString(),
      config: body.config ?? {},
    })
    .returning()
  return c.json(view(inserted[0]), 201)
})

dashboardsRouter.put('/:id', async (c) => {
  const body = await c.req.json<{ name?: string; config?: unknown }>()
  const updates: Partial<typeof dashboards.$inferInsert> = { updatedAt: new Date() }
  if (typeof body.name === 'string') updates.name = body.name
  if (body.config !== undefined) updates.config = body.config
  const updated = await db
    .update(dashboards)
    .set(updates)
    .where(
      and(eq(dashboards.id, c.req.param('id')), eq(dashboards.userId, c.get('userId'))),
    )
    .returning()
  if (!updated[0]) return c.json({ error: 'not found' }, 404)
  return c.json(view(updated[0]))
})

dashboardsRouter.delete('/:id', async (c) => {
  await db
    .delete(dashboards)
    .where(
      and(eq(dashboards.id, c.req.param('id')), eq(dashboards.userId, c.get('userId'))),
    )
  return c.json({ ok: true })
})
