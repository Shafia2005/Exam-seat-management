import type { Prisma } from '@prisma/client'
import type { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { generateTemporaryPassword, hashPassword } from '@/lib/auth/password'
import type { AdminUser, AuditLogEntry } from '@/types/admin.types'
import { audit } from '../audit'
import { ApiError, conflict, forbidden, notFound } from '../http'
import { adminSelect, fullName, toAdminDto, toAuditDto } from '../mappers'
import type { AuthContext } from '../session'
import type { adminCreateSchema, adminUpdateSchema, auditListQuery } from '../validation'
import { resetUserPassword } from './auth.service'

const ROLE_NAME = { ADMIN: 'administrator', SUPER_ADMIN: 'super administrator' } as const

/** Only super administrators manage administrator accounts. */
function assertSuperAdmin(ctx: AuthContext) {
  if (ctx.role !== 'SUPER_ADMIN') throw forbidden('Only a super administrator can manage administrator accounts.')
}

export async function listAdmins(ctx: AuthContext): Promise<AdminUser[]> {
  const rows = await prisma.user.findMany({
    where: { organizationId: ctx.organizationId, role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    select: adminSelect,
    orderBy: [{ role: 'desc' }, { firstName: 'asc' }, { lastName: 'asc' }],
  })
  return rows.map(toAdminDto)
}

async function findAdmin(ctx: AuthContext, id: string) {
  const user = await prisma.user.findFirst({
    where: { id, organizationId: ctx.organizationId, role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    select: adminSelect,
  })
  if (!user) throw notFound('Administrator not found')
  return user
}

export async function createAdmin(
  ctx: AuthContext,
  input: z.infer<typeof adminCreateSchema>
): Promise<{ admin: AdminUser; temporaryPassword?: string }> {
  assertSuperAdmin(ctx)
  const existing = await prisma.user.findUnique({
    where: { organizationId_email: { organizationId: ctx.organizationId, email: input.email } },
    select: { role: true },
  })
  if (existing) {
    throw conflict(
      existing.role === 'ADMIN' || existing.role === 'SUPER_ADMIN'
        ? 'An administrator with this email already exists.'
        : `This email belongs to a ${existing.role.toLowerCase()} account. Use a different email for the administrator.`,
      'DUPLICATE'
    )
  }

  const temporaryPassword = input.password ? undefined : generateTemporaryPassword()
  const user = await prisma.user.create({
    data: {
      organizationId: ctx.organizationId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      passwordHash: await hashPassword(input.password ?? temporaryPassword!),
    },
    select: adminSelect,
  })
  await audit(ctx, {
    action: 'admin.created',
    entityType: 'user',
    entityId: user.id,
    summary: `Added ${ROLE_NAME[input.role]} ${fullName(user)} (${user.email})`,
  })
  return { admin: toAdminDto(user), temporaryPassword }
}

/** Every organization must keep at least one active super administrator. */
async function assertKeepsSuperAdmin(ctx: AuthContext, userId: string) {
  const others = await prisma.user.count({
    where: { organizationId: ctx.organizationId, role: 'SUPER_ADMIN', isActive: true, id: { not: userId } },
  })
  if (others === 0) {
    throw new ApiError(409, 'LAST_SUPER_ADMIN', 'The organization needs at least one active super administrator.')
  }
}

export async function updateAdmin(ctx: AuthContext, id: string, input: z.infer<typeof adminUpdateSchema>): Promise<AdminUser> {
  assertSuperAdmin(ctx)
  const target = await findAdmin(ctx, id)

  const demoting = input.role === 'ADMIN' && target.role === 'SUPER_ADMIN'
  const deactivating = input.isActive === false && target.isActive
  if (id === ctx.userId && (demoting || deactivating)) {
    throw conflict('You cannot deactivate or demote your own account. Ask another super administrator.', 'SELF_CHANGE')
  }
  if (target.role === 'SUPER_ADMIN' && target.isActive && (demoting || deactivating)) await assertKeepsSuperAdmin(ctx, id)

  const data: Prisma.UserUpdateInput = {
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
    isActive: input.isActive,
  }
  // Deactivation also ends existing sessions (requireAuth rejects inactive users).
  const user = await prisma.user.update({ where: { id }, data, select: adminSelect })

  const changes: string[] = []
  if (input.role && input.role !== target.role) changes.push(`role → ${ROLE_NAME[input.role]}`)
  if (input.isActive !== undefined && input.isActive !== target.isActive) changes.push(input.isActive ? 'reactivated' : 'deactivated')
  if ((input.firstName && input.firstName !== target.firstName) || (input.lastName && input.lastName !== target.lastName)) {
    changes.push('name updated')
  }
  if (changes.length) {
    await audit(ctx, {
      action: 'admin.updated',
      entityType: 'user',
      entityId: id,
      summary: `Updated administrator ${fullName(user)}: ${changes.join(', ')}`,
    })
  }
  return toAdminDto(user)
}

export async function resetAdminPassword(ctx: AuthContext, id: string, password?: string) {
  assertSuperAdmin(ctx)
  const target = await findAdmin(ctx, id)
  if (id === ctx.userId) throw conflict('Use “Change password” to change your own password.', 'SELF_CHANGE')
  const result = await resetUserPassword(id, password)
  await audit(ctx, {
    action: 'admin.password-reset',
    entityType: 'user',
    entityId: id,
    summary: `Reset the password of administrator ${fullName(target)}`,
  })
  return result
}

// ─── Audit log ──────────────────────────────────────────────────────────────

export async function listAuditLogs(
  ctx: AuthContext,
  q: z.infer<typeof auditListQuery>
): Promise<{ rows: AuditLogEntry[]; total: number }> {
  const where: Prisma.AuditLogWhereInput = {
    organizationId: ctx.organizationId,
    entityType: q.entityType,
    OR: q.search
      ? [
          { summary: { contains: q.search, mode: 'insensitive' } },
          { actorName: { contains: q.search, mode: 'insensitive' } },
          { action: { contains: q.search, mode: 'insensitive' } },
        ]
      : undefined,
  }
  const [total, rows] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit }),
  ])
  return { rows: rows.map(toAuditDto), total }
}
