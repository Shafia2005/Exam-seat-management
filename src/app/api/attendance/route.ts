import { STAFF_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok, parseBody, parseQuery } from '@/server/http'
import { requireAuth } from '@/server/session'
import { getHallAttendance, markAttendance } from '@/server/services/attendance.service'
import { hallQuery, markAttendanceSchema } from '@/server/validation'

/** Seats and attendance for one hall and paper (`?sessionId=&roomId=`). Teachers only see halls they invigilate. */
export const GET = apiHandler(async (req) => {
  const ctx = await requireAuth(req, STAFF_ROLES)
  const { sessionId, roomId } = parseQuery(req, hallQuery)
  return ok(await getHallAttendance(ctx, sessionId, roomId))
})

/** Marks students present/absent (or clears a mark with `status: null`). */
export const PUT = apiHandler(async (req) => {
  const ctx = await requireAuth(req, STAFF_ROLES)
  return ok(await markAttendance(ctx, await parseBody(req, markAttendanceSchema)))
})
