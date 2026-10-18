import { STAFF_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok, parseQuery } from '@/server/http'
import { requireAuth } from '@/server/session'
import { getTeacherWorkload } from '@/server/services/duties.service'
import { workloadQuery } from '@/server/validation'

/**
 * Duty counts per teacher: overall, for `?examId=`, or for the day of
 * `?sessionId=` (counting every exam that day, with a `busy` flag for clashes).
 */
export const GET = apiHandler(async (req) => {
  const ctx = await requireAuth(req, STAFF_ROLES)
  return ok(await getTeacherWorkload(ctx, parseQuery(req, workloadQuery)))
})
