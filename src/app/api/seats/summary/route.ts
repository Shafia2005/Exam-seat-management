import { STAFF_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok } from '@/server/http'
import { requireAuth } from '@/server/session'
import { getAllocationSummary } from '@/server/services/seats.service'

/** Seat counts per exam and per paper/room, without the individual seats. */
export const GET = apiHandler(async (req) => {
  const ctx = await requireAuth(req, STAFF_ROLES)
  return ok(await getAllocationSummary(ctx))
})
