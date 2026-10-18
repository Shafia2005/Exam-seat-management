import { ADMIN_ROLES, STAFF_ROLES } from '@/lib/auth/roles'
import { apiHandler, created, paginated, parseBody, parseQuery } from '@/server/http'
import { requireAuth } from '@/server/session'
import { createStudent, listStudents } from '@/server/services/students.service'
import { studentCreateSchema, studentListQuery } from '@/server/validation'

export const GET = apiHandler(async (req) => {
  const ctx = await requireAuth(req, STAFF_ROLES)
  const query = parseQuery(req, studentListQuery)
  const { rows, total } = await listStudents(ctx, query)
  return paginated(rows, query.page, query.limit, total)
})

export const POST = apiHandler(async (req) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  const { student, temporaryPassword } = await createStudent(ctx, await parseBody(req, studentCreateSchema))
  return created(student, temporaryPassword ? { temporaryPassword } : undefined)
})
