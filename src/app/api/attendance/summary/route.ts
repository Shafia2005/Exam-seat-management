import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok, parseQuery } from '@/server/http'
import { requireAuth } from '@/server/session'
import { getAttendanceSummary } from '@/server/services/attendance.service'
import { examIdQuery } from '@/server/validation'

/** Present/absent/pending counts per paper and hall for `?examId=`. */
export const GET = apiHandler(async (req) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  const { examId } = parseQuery(req, examIdQuery)
  return ok(await getAttendanceSummary(ctx, examId))
})
