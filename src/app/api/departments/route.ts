import { ADMIN_ROLES, STAFF_ROLES } from '@/lib/auth/roles'
import { apiHandler, created, ok, parseBody } from '@/server/http'
import { requireAuth } from '@/server/session'
import { createDepartment, listDepartments } from '@/server/services/infrastructure.service'
import { departmentCreateSchema } from '@/server/validation'

export const GET = apiHandler(async (req) => {
  const ctx = await requireAuth(req, STAFF_ROLES)
  return ok(await listDepartments(ctx))
})

export const POST = apiHandler(async (req) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  return created(await createDepartment(ctx, await parseBody(req, departmentCreateSchema)))
})
