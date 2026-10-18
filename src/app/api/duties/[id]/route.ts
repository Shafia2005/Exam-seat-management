import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok } from '@/server/http'
import { requireAuth } from '@/server/session'
import { removeDuty } from '@/server/services/duties.service'

type Params = { id: string }

export const DELETE = apiHandler<Params>(async (req, { params }) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  await removeDuty(ctx, params.id)
  return ok({ id: params.id, deleted: true })
})
