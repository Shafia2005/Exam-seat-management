import { ADMIN_ROLES, STAFF_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok, parseQuery } from '@/server/http'
import { requireAuth } from '@/server/session'
import { clearAllocation, listAllocations } from '@/server/services/seats.service'
import { allocationListQuery, clearAllocationQuery } from '@/server/validation'

/** Seating plans grouped per paper; narrow with `?examId=` and/or `?sessionId=`. */
export const GET = apiHandler(async (req) => {
  const ctx = await requireAuth(req, STAFF_ROLES)
  return ok(await listAllocations(ctx, parseQuery(req, allocationListQuery)))
})

/** Clears seating for `?examId=`, or only one paper with `&sessionId=`. */
export const DELETE = apiHandler(async (req) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  const { examId, sessionId } = parseQuery(req, clearAllocationQuery)
  return ok({ examId, sessionId, removed: await clearAllocation(ctx, examId, sessionId) })
})
