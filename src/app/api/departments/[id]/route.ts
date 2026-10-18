import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok, parseBody } from '@/server/http'
import { requireAuth } from '@/server/session'
import { deleteDepartment, updateDepartment } from '@/server/services/infrastructure.service'
import { departmentUpdateSchema } from '@/server/validation'

type Params = { id: string }

export const PATCH = apiHandler<Params>(async (req, { params }) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  return ok(await updateDepartment(ctx, params.id, await parseBody(req, departmentUpdateSchema)))
})

export const DELETE = apiHandler<Params>(async (req, { params }) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  await deleteDepartment(ctx, params.id)
  return ok({ id: params.id, deleted: true })
})
