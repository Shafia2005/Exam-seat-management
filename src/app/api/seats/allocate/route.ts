import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok, parseBody } from '@/server/http'
import { requireAuth } from '@/server/session'
import { allocateSeats } from '@/server/services/seats.service'
import { allocateSeatsSchema } from '@/server/validation'

/** Runs the chosen algorithm and replaces the seating of the chosen papers (default: every paper). */
export const POST = apiHandler(async (req) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  return ok(await allocateSeats(ctx, await parseBody(req, allocateSeatsSchema)))
})
