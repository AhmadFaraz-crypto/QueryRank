import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/client'
import { datasets } from '../db/schema'
import { getSession } from '../session'

export const datasetsRouter = new Hono<{ Variables: { userId: string } }>()

// All dataset routes require a signed-in user; rows are always user-scoped.
datasetsRouter.use('*', async (c, next) => {
  const session = await getSession(c)
  if (!session) return c.json({ error: 'unauthorized' }, 401)
  c.set('userId', session.sub)
  await next()
})

datasetsRouter.get('/', async (c) => {
  const rows = await db
    .select()
    .from(datasets)
    .where(eq(datasets.userId, c.get('userId')))
    .orderBy(desc(datasets.createdAt))
  // Return the stored normalized dataset verbatim so the client can render it.
  return c.json(rows.map((r) => r.data))
})

datasetsRouter.post('/', async (c) => {
  const body = await c.req.json<{ id?: string; name?: string; source?: string; data?: unknown }>()
  if (!body.id || !body.data) return c.json({ error: 'id and data required' }, 400)
  await db
    .insert(datasets)
    .values({
      id: body.id,
      userId: c.get('userId'),
      name: (body.name ?? 'Import').toString(),
      source: (body.source ?? '').toString(),
      data: body.data,
    })
    // Re-importing the same id replaces it rather than erroring.
    .onConflictDoUpdate({
      target: [datasets.userId, datasets.id],
      set: { name: (body.name ?? 'Import').toString(), data: body.data },
    })
  return c.json({ ok: true }, 201)
})

datasetsRouter.delete('/:id', async (c) => {
  await db
    .delete(datasets)
    .where(and(eq(datasets.id, c.req.param('id')), eq(datasets.userId, c.get('userId'))))
  return c.json({ ok: true })
})
