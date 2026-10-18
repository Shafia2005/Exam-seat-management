import { ADMIN_ROLES, STAFF_ROLES } from '@/lib/auth/roles'
import { apiHandler, created, ok, parseBody, parseQuery } from '@/server/http'
import { requireAuth } from '@/server/session'
import { assignDuty, clearDuties, getDutyRoster } from '@/server/services/duties.service'
import { assignDutySchema, clearDutiesQuery, dutyRosterQuery } from '@/server/validation'

/** Duty roster for one paper (`?sessionId=`). */
export const GET = apiHandler(async (req) => {
  const ctx = await requireAuth(req, STAFF_ROLES)
  const { sessionId } = parseQuery(req, dutyRosterQuery)
  return ok(await getDutyRoster(ctx, sessionId))
})

/** Manually assigns (or re-assigns) a teacher to a room for one paper. */
export const POST = apiHandler(async (req) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  return created(await assignDuty(ctx, await parseBody(req, assignDutySchema)))
})

/** Clears duties for `?examId=`, or only one paper with `&sessionId=`. */
export const DELETE = apiHandler(async (req) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  const { examId, sessionId } = parseQuery(req, clearDutiesQuery)
  return ok({ examId, sessionId, removed: await clearDuties(ctx, examId, sessionId) })
})
