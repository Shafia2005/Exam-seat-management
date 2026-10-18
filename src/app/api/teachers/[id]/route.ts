import { ADMIN_ROLES, STAFF_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok, parseBody } from '@/server/http'
import { requireAuth } from '@/server/session'
import { deleteTeacher, getTeacher, updateTeacher } from '@/server/services/teachers.service'
import { teacherUpdateSchema } from '@/server/validation'

type Params = { id: string }

export const GET = apiHandler<Params>(async (req, { params }) => {
  const ctx = await requireAuth(req, STAFF_ROLES)
  return ok(await getTeacher(ctx, params.id))
})

const update = apiHandler<Params>(async (req, { params }) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  return ok(await updateTeacher(ctx, params.id, await parseBody(req, teacherUpdateSchema)))
})

export const PUT = update
export const PATCH = update

export const DELETE = apiHandler<Params>(async (req, { params }) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  await deleteTeacher(ctx, params.id)
  return ok({ id: params.id, deleted: true })
})
