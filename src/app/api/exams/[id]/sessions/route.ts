import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, created, parseBody } from '@/server/http'
import { requireAuth } from '@/server/session'
import { addExamSession } from '@/server/services/exams.service'
import { examSessionSchema } from '@/server/validation'

type Params = { id: string }

/** Adds a subject sitting to the exam and returns the updated exam. */
export const POST = apiHandler<Params>(async (req, { params }) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  return created(await addExamSession(ctx, params.id, await parseBody(req, examSessionSchema)))
})
