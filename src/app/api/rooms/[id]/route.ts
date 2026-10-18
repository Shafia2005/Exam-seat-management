import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok, parseBody } from '@/server/http'
import { requireAuth } from '@/server/session'
import { deleteRoom, updateRoom } from '@/server/services/infrastructure.service'
import { roomUpdateSchema } from '@/server/validation'

type Params = { id: string }

export const PATCH = apiHandler<Params>(async (req, { params }) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  return ok(await updateRoom(ctx, params.id, await parseBody(req, roomUpdateSchema)))
})

/** Refused while exams have seats or duties in the room. */
export const DELETE = apiHandler<Params>(async (req, { params }) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  await deleteRoom(ctx, params.id)
  return ok({ id: params.id, deleted: true })
})
