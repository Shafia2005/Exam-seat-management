import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, created, paginated, parseBody, parseQuery } from '@/server/http'
import { requireAuth } from '@/server/session'
import { createExam, listExams } from '@/server/services/exams.service'
import { examCreateSchema, examListQuery } from '@/server/validation'

/** All roles can read the schedule; drafts are only visible to admins. */
export const GET = apiHandler(async (req) => {
  const ctx = await requireAuth(req)
  const query = parseQuery(req, examListQuery)
  const { rows, total } = await listExams(ctx, query)
  return paginated(rows, query.page, query.limit, total)
})

export const POST = apiHandler(async (req) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  return created(await createExam(ctx, await parseBody(req, examCreateSchema)))
})
