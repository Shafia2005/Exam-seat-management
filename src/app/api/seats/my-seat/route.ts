import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok, parseQuery } from '@/server/http'
import { requireAuth } from '@/server/session'
import { getMySeat } from '@/server/services/seats.service'
import { mySeatQuery } from '@/server/validation'

/** The signed-in student's seats. Admins may pass `?studentId=` to preview a student. */
export const GET = apiHandler(async (req) => {
  const ctx = await requireAuth(req, [...ADMIN_ROLES, 'STUDENT'])
  const { studentId } = parseQuery(req, mySeatQuery)
  return ok(await getMySeat(ctx, studentId))
})
