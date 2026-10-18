import type { Prisma, TeacherStatus } from '@prisma/client'
import type { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { generateTemporaryPassword, hashPassword } from '@/lib/auth/password'
import { TEACHER_IMPORT_COLUMNS, canonicalizeRow } from '@/lib/import-columns'
import type { ImportResult } from '@/types/admin.types'
import type { Teacher } from '@/types/teacher.types'
import { audit } from '../audit'
import { badRequest, notFound } from '../http'
import { fullName, parseOptionalDate, teacherInclude, toTeacherDto } from '../mappers'
import type { AuthContext } from '../session'
import {
  teacherImportRowSchema,
  type TeacherCreateInput,
  type TeacherListQuery,
  type TeacherUpdateInput,
  type importSchema,
} from '../validation'
import { resetUserPassword } from './auth.service'

function searchFilter(search: string): Prisma.TeacherWhereInput[] {
  return search
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => {
      const contains = { contains: term, mode: 'insensitive' as const }
      return {
        OR: [
          { employeeId: contains },
          { designation: contains },
          { user: { is: { firstName: contains } } },
          { user: { is: { lastName: contains } } },
          { user: { is: { email: contains } } },
        ],
      }
    })
}

const toStatus = (s: string | undefined) => s?.toUpperCase() as TeacherStatus | undefined

export async function listTeachers(ctx: AuthContext, q: TeacherListQuery): Promise<{ rows: Teacher[]; total: number }> {
  const where: Prisma.TeacherWhereInput = {
    organizationId: ctx.organizationId,
    departmentId: q.departmentId,
    isAvailable: q.isAvailable,
    AND: q.search ? searchFilter(q.search) : undefined,
  }
  if (q.status && q.status !== 'all') where.status = toStatus(q.status)

  const [total, rows] = await prisma.$transaction([
    prisma.teacher.count({ where }),
    prisma.teacher.findMany({
      where,
      include: teacherInclude,
      orderBy: [{ employeeId: 'asc' }, { id: 'asc' }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
  ])
  return { rows: rows.map(toTeacherDto), total }
}

export async function getTeacher(ctx: AuthContext, id: string): Promise<Teacher> {
  const teacher = await prisma.teacher.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: teacherInclude,
  })
  if (!teacher) throw notFound('Teacher not found')
  return toTeacherDto(teacher)
}

async function assertDepartment(organizationId: string, departmentId: string) {
  const department = await prisma.department.findFirst({ where: { id: departmentId, organizationId }, select: { id: true } })
  if (!department) throw badRequest('The selected department does not exist')
}

export async function createTeacher(
  ctx: AuthContext,
  input: TeacherCreateInput
): Promise<{ teacher: Teacher; temporaryPassword?: string }> {
  await assertDepartment(ctx.organizationId, input.departmentId)
  const temporaryPassword = input.password ? undefined : generateTemporaryPassword()

  const user = await prisma.user.create({
    data: {
      organizationId: ctx.organizationId,
      email: input.email,
      passwordHash: await hashPassword(input.password ?? temporaryPassword!),
      firstName: input.firstName,
      lastName: input.lastName,
      role: 'TEACHER',
      teacher: {
        create: {
          organizationId: ctx.organizationId,
          employeeId: input.employeeId,
          departmentId: input.departmentId,
          designation: input.designation,
          phone: input.phone,
          specialization: input.specialization,
          qualification: input.qualification,
          experienceYears: input.experienceYears ?? 0,
          joiningDate: parseOptionalDate(input.joiningDate),
          maxDuties: input.maxDutiesPerDay ?? 2,
          isAvailable: input.isAvailable ?? true,
          status: toStatus(input.status) ?? 'ACTIVE',
        },
      },
    },
    include: { teacher: { include: teacherInclude } },
  })

  await audit(ctx, {
    action: 'teacher.created',
    entityType: 'teacher',
    entityId: user.teacher!.id,
    summary: `Added teacher ${input.employeeId} (${fullName(user)})`,
  })
  return { teacher: toTeacherDto(user.teacher!), temporaryPassword }
}

export async function updateTeacher(ctx: AuthContext, id: string, input: TeacherUpdateInput): Promise<Teacher> {
  const existing = await prisma.teacher.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: { isAvailable: true, maxDuties: true },
  })
  if (!existing) throw notFound('Teacher not found')
  if (input.departmentId) await assertDepartment(ctx.organizationId, input.departmentId)

  const updated = await prisma.teacher.update({
    where: { id },
    data: {
      employeeId: input.employeeId,
      department: input.departmentId ? { connect: { id: input.departmentId } } : undefined,
      designation: input.designation,
      phone: input.phone,
      specialization: input.specialization,
      qualification: input.qualification,
      experienceYears: input.experienceYears,
      joiningDate: parseOptionalDate(input.joiningDate),
      maxDuties: input.maxDutiesPerDay,
      isAvailable: input.isAvailable,
      status: toStatus(input.status),
      user: {
        update: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          ...(input.password ? { passwordHash: await hashPassword(input.password), passwordChangedAt: new Date() } : {}),
        },
      },
    },
    include: teacherInclude,
  })

  const details: string[] = []
  if (input.isAvailable !== undefined && input.isAvailable !== existing.isAvailable) {
    details.push(input.isAvailable ? 'available for duty' : 'not available for duty')
  }
  if (input.maxDutiesPerDay !== undefined && input.maxDutiesPerDay !== existing.maxDuties) {
    details.push(`daily duty limit ${existing.maxDuties} → ${input.maxDutiesPerDay}`)
  }
  await audit(ctx, {
    action: 'teacher.updated',
    entityType: 'teacher',
    entityId: id,
    summary: `Updated teacher ${updated.employeeId} (${fullName(updated.user)})${details.length ? `: ${details.join(', ')}` : ''}`,
  })
  return toTeacherDto(updated)
}

export async function resetTeacherPassword(ctx: AuthContext, id: string, password?: string) {
  const teacher = await prisma.teacher.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: { userId: true, employeeId: true },
  })
  if (!teacher) throw notFound('Teacher not found')
  const result = await resetUserPassword(teacher.userId, password)
  await audit(ctx, {
    action: 'teacher.password-reset',
    entityType: 'teacher',
    entityId: id,
    summary: `Reset the password of teacher ${teacher.employeeId}`,
  })
  return result
}

/** Deletes the teacher's login account; the profile and duties cascade with it. */
export async function deleteTeacher(ctx: AuthContext, id: string): Promise<void> {
  const teacher = await prisma.teacher.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: { userId: true, employeeId: true, user: { select: { firstName: true, lastName: true } } },
  })
  if (!teacher) throw notFound('Teacher not found')
  await prisma.user.delete({ where: { id: teacher.userId } })
  await audit(ctx, {
    action: 'teacher.deleted',
    entityType: 'teacher',
    entityId: id,
    summary: `Deleted teacher ${teacher.employeeId} (${fullName(teacher.user)})`,
  })
}

// ─── Bulk import ────────────────────────────────────────────────────────────

type TeacherImportRow = z.infer<typeof teacherImportRowSchema>

/** Same contract as `importStudents`: invalid rows are reported and skipped. */
export async function importTeachers(ctx: AuthContext, input: z.infer<typeof importSchema>): Promise<ImportResult> {
  const departments = await prisma.department.findMany({
    where: { organizationId: ctx.organizationId },
    select: { id: true, code: true, name: true },
  })
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
  const findDepartment = (v: string) => departments.find((d) => same(d.code, v) || same(d.name, v))

  const errors: ImportResult['errors'] = []
  const valid: { row: number; data: TeacherImportRow; departmentId: string }[] = []
  const seenEmail = new Map<string, number>()
  const seenEmployee = new Map<string, number>()

  input.rows.forEach((raw, i) => {
    const row = i + 1
    const parsed = teacherImportRowSchema.safeParse(canonicalizeRow(raw, TEACHER_IMPORT_COLUMNS))
    if (!parsed.success) {
      errors.push({ row, message: parsed.error.issues.map((e) => e.message).join('; ') })
      return
    }
    const data = parsed.data
    const department = findDepartment(data.department)
    if (!department) {
      errors.push({ row, message: `Department “${data.department}” does not exist` })
      return
    }
    const employee = data.employeeId.toLowerCase()
    const dupes: string[] = []
    if (seenEmail.has(data.email)) dupes.push(`email repeats row ${seenEmail.get(data.email)}`)
    if (seenEmployee.has(employee)) dupes.push(`employee ID repeats row ${seenEmployee.get(employee)}`)
    if (dupes.length) {
      errors.push({ row, message: dupes.join('; ') })
      return
    }
    seenEmail.set(data.email, row)
    seenEmployee.set(employee, row)
    valid.push({ row, data, departmentId: department.id })
  })

  if (valid.length) {
    const [users, employees] = await Promise.all([
      prisma.user.findMany({
        where: { organizationId: ctx.organizationId, email: { in: valid.map((v) => v.data.email) } },
        select: { email: true },
      }),
      prisma.teacher.findMany({
        where: { organizationId: ctx.organizationId, employeeId: { in: valid.map((v) => v.data.employeeId), mode: 'insensitive' } },
        select: { employeeId: true },
      }),
    ])
    const takenEmail = new Set(users.map((u) => u.email))
    const takenEmployee = new Set(employees.map((e) => e.employeeId.toLowerCase()))
    for (let i = valid.length - 1; i >= 0; i--) {
      const { row, data } = valid[i]
      const clashes: string[] = []
      if (takenEmail.has(data.email)) clashes.push('an account with this email already exists')
      if (takenEmployee.has(data.employeeId.toLowerCase())) clashes.push('this employee ID already exists')
      if (clashes.length) {
        errors.push({ row, message: clashes.join('; ') })
        valid.splice(i, 1)
      }
    }
  }
  errors.sort((a, b) => a.row - b.row)

  const result: ImportResult = { total: input.rows.length, created: 0, failed: errors.length, errors, validateOnly: input.validateOnly }
  if (input.validateOnly || !valid.length) return result

  const passwordHash = await hashPassword(input.password)
  await prisma.$transaction(
    async (tx) => {
      for (let i = 0; i < valid.length; i += 500) {
        const chunk = valid.slice(i, i + 500)
        const users = await tx.user.createManyAndReturn({
          data: chunk.map(({ data }) => ({
            organizationId: ctx.organizationId,
            email: data.email,
            passwordHash,
            firstName: data.firstName,
            lastName: data.lastName,
            role: 'TEACHER' as const,
          })),
          select: { id: true, email: true },
        })
        const userIdByEmail = new Map(users.map((u) => [u.email, u.id]))
        await tx.teacher.createMany({
          data: chunk.map(({ data, departmentId }) => ({
            organizationId: ctx.organizationId,
            userId: userIdByEmail.get(data.email)!,
            employeeId: data.employeeId,
            departmentId,
            designation: data.designation,
            phone: data.phone,
            qualification: data.qualification,
            specialization: data.specialization,
            experienceYears: data.experienceYears ?? 0,
            maxDuties: data.maxDutiesPerDay ?? 2,
          })),
        })
      }
    },
    { timeout: 60_000 }
  )

  result.created = valid.length
  const skipped = errors.length ? ` (${errors.length} row${errors.length === 1 ? '' : 's'} skipped)` : ''
  await audit(ctx, {
    action: 'teacher.imported',
    entityType: 'teacher',
    summary: `Imported ${valid.length} teacher${valid.length === 1 ? '' : 's'} from a spreadsheet${skipped}`,
    metadata: { created: valid.length, skipped: errors.length },
  })
  return result
}
