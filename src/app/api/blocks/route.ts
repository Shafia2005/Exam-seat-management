import { ADMIN_ROLES, STAFF_ROLES } from '@/lib/auth/roles'
import { apiHandler, created, ok, parseBody, parseQuery } from '@/server/http'
import { requireAuth } from '@/server/session'
import { createBlock, listBlocks } from '@/server/services/infrastructure.service'
import { blockCreateSchema, blockListQuery } from '@/server/validation'

/** Active blocks; `?includeInactive=true` lists all. */
export const GET = apiHandler(async (req) => {
  const ctx = await requireAuth(req, STAFF_ROLES)
  return ok(await listBlocks(ctx, parseQuery(req, blockListQuery)))
})

export const POST = apiHandler(async (req) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  return created(await createBlock(ctx, await parseBody(req, blockCreateSchema)))
})
