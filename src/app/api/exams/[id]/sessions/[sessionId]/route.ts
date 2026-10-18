import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok, parseBody } from '@/server/http'
import { requireAuth } from '@/server/session'
import { deleteExamSession, updateExamSession } from '@/server/services/exams.service'
import { examSessionUpdateSchema } from '@/server/validation'

type Params = { id: string; sessionId: string }

/** Edits a paper and returns the updated exam. */
export const PATCH = apiHandler<Params>(async (req, { params }) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  return ok(await updateExamSession(ctx, params.id, params.sessionId, await parseBody(req, examSessionUpdateSchema)))
})

/** Removes a paper with its seating and duties, and returns the updated exam. */
export const DELETE = apiHandler<Params>(async (req, { params }) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  return ok(await deleteExamSession(ctx, params.id, params.sessionId))
})
