import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok, parseQuery } from '@/server/http'
import { requireAuth } from '@/server/session'
import { getMyDuties } from '@/server/services/duties.service'
import { myDutiesQuery } from '@/server/validation'

/** The signed-in teacher's duties. Admins may pass `?teacherId=` to preview a teacher. */
export const GET = apiHandler(async (req) => {
  const ctx = await requireAuth(req, [...ADMIN_ROLES, 'TEACHER'])
  const { teacherId, examId } = parseQuery(req, myDutiesQuery)
  return ok(await getMyDuties(ctx, teacherId, examId))
})
