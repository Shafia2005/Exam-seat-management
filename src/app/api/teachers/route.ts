import { ADMIN_ROLES, STAFF_ROLES } from '@/lib/auth/roles'
import { apiHandler, created, paginated, parseBody, parseQuery } from '@/server/http'
import { requireAuth } from '@/server/session'
import { createTeacher, listTeachers } from '@/server/services/teachers.service'
import { teacherCreateSchema, teacherListQuery } from '@/server/validation'

export const GET = apiHandler(async (req) => {
  const ctx = await requireAuth(req, STAFF_ROLES)
  const query = parseQuery(req, teacherListQuery)
  const { rows, total } = await listTeachers(ctx, query)
  return paginated(rows, query.page, query.limit, total)
})

export const POST = apiHandler(async (req) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  const { teacher, temporaryPassword } = await createTeacher(ctx, await parseBody(req, teacherCreateSchema))
  return created(teacher, temporaryPassword ? { temporaryPassword } : undefined)
})
