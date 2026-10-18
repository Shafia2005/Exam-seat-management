import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok, parseBody } from '@/server/http'
import { requireAuth } from '@/server/session'
import { deleteExam, getExam, updateExam } from '@/server/services/exams.service'
import { examUpdateSchema } from '@/server/validation'

type Params = { id: string }

export const GET = apiHandler<Params>(async (req, { params }) => {
  const ctx = await requireAuth(req)
  return ok(await getExam(ctx, params.id))
})

/** Also used to publish (`status: "scheduled"`) and cancel (`status: "cancelled"`). */
const update = apiHandler<Params>(async (req, { params }) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  return ok(await updateExam(ctx, params.id, await parseBody(req, examUpdateSchema)))
})

export const PUT = update
export const PATCH = update

export const DELETE = apiHandler<Params>(async (req, { params }) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  await deleteExam(ctx, params.id)
  return ok({ id: params.id, deleted: true })
})
