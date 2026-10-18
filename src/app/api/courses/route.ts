import { ADMIN_ROLES, STAFF_ROLES } from '@/lib/auth/roles'
import { apiHandler, created, ok, parseBody, parseQuery } from '@/server/http'
import { requireAuth } from '@/server/session'
import { createCourse, listCourses } from '@/server/services/infrastructure.service'
import { courseCreateSchema, courseListQuery } from '@/server/validation'

export const GET = apiHandler(async (req) => {
  const ctx = await requireAuth(req, STAFF_ROLES)
  return ok(await listCourses(ctx, parseQuery(req, courseListQuery)))
})

export const POST = apiHandler(async (req) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  return created(await createCourse(ctx, await parseBody(req, courseCreateSchema)))
})
