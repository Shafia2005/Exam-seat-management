import { ADMIN_ROLES, STAFF_ROLES } from '@/lib/auth/roles'
import { apiHandler, created, ok, parseBody, parseQuery } from '@/server/http'
import { requireAuth } from '@/server/session'
import { createRoom, listRooms } from '@/server/services/infrastructure.service'
import { roomCreateSchema, roomListQuery } from '@/server/validation'

export const GET = apiHandler(async (req) => {
  const ctx = await requireAuth(req, STAFF_ROLES)
  return ok(await listRooms(ctx, parseQuery(req, roomListQuery)))
})

/** Creates the room and generates its bench grid. */
export const POST = apiHandler(async (req) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  return created(await createRoom(ctx, await parseBody(req, roomCreateSchema)))
})
