import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok, parseBody } from '@/server/http'
import { requireAuth } from '@/server/session'
import { deleteBlock, updateBlock } from '@/server/services/infrastructure.service'
import { blockUpdateSchema } from '@/server/validation'

type Params = { id: string }

export const PATCH = apiHandler<Params>(async (req, { params }) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  return ok(await updateBlock(ctx, params.id, await parseBody(req, blockUpdateSchema)))
})

export const DELETE = apiHandler<Params>(async (req, { params }) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  await deleteBlock(ctx, params.id)
  return ok({ id: params.id, deleted: true })
})
