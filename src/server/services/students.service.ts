import type { Gender, Prisma, StudentStatus } from '@prisma/client'
import type { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { generateTemporaryPassword, hashPassword } from '@/lib/auth/password'
import { STUDENT_IMPORT_COLUMNS, canonicalizeRow } from '@/lib/import-columns'
import type { ImportResult } from '@/types/admin.types'
import type { Student } from '@/types/student.types'
import { audit } from '../audit'
import { badRequest, notFound } from '../http'
import { fullName, parseDateOnly, parseOptionalDate, studentInclude, toStudentDto } from '../mappers'
import type { AuthContext } from '../session'
import {
  studentImportRowSchema,
  type StudentCreateInput,
  type StudentListQuery,
  type StudentUpdateInput,
  type importSchema,
} from '../validation'
import { resetUserPassword } from './auth.service'

type SortDir = Prisma.SortOrder

const SORTABLE: Record<NonNullable<StudentListQuery['sortBy']>, (dir: SortDir) => Prisma.StudentOrderByWithRelationInput> = {
  rollNumber: (dir) => ({ rollNumber: dir }),
  firstName: (dir) => ({ user: { firstName: dir } }),
  lastName: (dir) => ({ user: { lastName: dir } }),
  email: (dir) => ({ user: { email: dir } }),
  currentSemester: (dir) => ({ currentSemester: dir }),
  attendancePercentage: (dir) => ({ attendancePercentage: dir }),
  batchYear: (dir) => ({ batchYear: dir }),
  createdAt: (dir) => ({ createdAt: dir }),
}

/** Every whitespace-separated term must match a name, email, roll or registration number. */
function searchFilter(search: string): Prisma.StudentWhereInput[] {
  return search
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => {
      const contains = { contains: term, mode: 'insensitive' as const }
      return {
        OR: [
          { rollNumber: contains },
          { registrationNumber: contains },
          { user: { is: { firstName: contains } } },
          { user: { is: { lastName: contains } } },
          { user: { is: { email: contains } } },
        ],
      }
    })
}

/** The institution's minimum attendance percentage for exam eligibility. */
export async function minimumAttendance(organizationId: string): Promise<number> {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { minAttendancePercent: true } })
  return org.minAttendancePercent
}

export async function listStudents(ctx: AuthContext, q: StudentListQuery): Promise<{ rows: Student[]; total: number }> {
  const where: Prisma.StudentWhereInput = {
    organizationId: ctx.organizationId,
    departmentId: q.departmentId ?? (q.departmentIds?.length ? { in: q.departmentIds } : undefined),
    courseId: q.courseId,
    currentSemester: q.semester ?? (q.semesters?.length ? { in: q.semesters } : undefined),
    section: q.section,
    AND: q.search ? searchFilter(q.search) : undefined,
  }
  if (q.status && q.status !== 'all') where.status = q.status.toUpperCase() as StudentStatus
  if (q.eligibility && q.eligibility !== 'all') where.isEligible = q.eligibility === 'eligible'

  const orderBy = [SORTABLE[q.sortBy ?? 'rollNumber'](q.sortOrder ?? 'asc'), { id: 'asc' as const }]
  const [total, rows] = await prisma.$transaction([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      include: studentInclude,
      orderBy,
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
  ])
  return { rows: rows.map(toStudentDto), total }
}

export async function getStudent(ctx: AuthContext, id: string): Promise<Student> {
  const student = await prisma.student.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: studentInclude,
  })
  if (!student) throw notFound('Student not found')
  return toStudentDto(student)
}

async function assertDepartmentAndCourse(organizationId: string, departmentId: string, courseId: string) {
  const [department, course] = await Promise.all([
    prisma.department.findFirst({ where: { id: departmentId, organizationId }, select: { id: true } }),
    prisma.course.findFirst({ where: { id: courseId, organizationId }, select: { departmentId: true } }),
  ])
  if (!department) throw badRequest('The selected department does not exist')
  if (!course) throw badRequest('The selected course does not exist')
  if (course.departmentId !== departmentId) {
    throw badRequest('The selected course does not belong to the selected department')
  }
}

const toGender = (g: string | undefined) => g?.toUpperCase() as Gender | undefined
const toStatus = (s: string | undefined) => s?.toUpperCase() as StudentStatus | undefined

export async function createStudent(
  ctx: AuthContext,
  input: StudentCreateInput
): Promise<{ student: Student; temporaryPassword?: string }> {
  await assertDepartmentAndCourse(ctx.organizationId, input.departmentId, input.courseId)

  const temporaryPassword = input.password ? undefined : generateTemporaryPassword()
  // New students have not missed any classes yet.
  const attendance = input.attendancePercentage ?? 100
  const threshold = await minimumAttendance(ctx.organizationId)

  const user = await prisma.user.create({
    data: {
      organizationId: ctx.organizationId,
      email: input.email,
      passwordHash: await hashPassword(input.password ?? temporaryPassword!),
      firstName: input.firstName,
      lastName: input.lastName,
      role: 'STUDENT',
      student: {
        create: {
          organizationId: ctx.organizationId,
          rollNumber: input.rollNumber,
          registrationNumber: input.registrationNumber,
          departmentId: input.departmentId,
          courseId: input.courseId,
          currentSemester: input.currentSemester,
          section: input.section,
          batchYear: input.batchYear,
          gender: toGender(input.gender)!,
          dateOfBirth: parseOptionalDate(input.dateOfBirth),
          bloodGroup: input.bloodGroup,
          phone: input.phone,
          admissionDate: parseOptionalDate(input.admissionDate),
          address: input.address,
          emergencyContactName: input.emergencyContactName,
          emergencyContactPhone: input.emergencyContactPhone,
          attendancePercentage: attendance,
          isEligible: input.isEligible ?? attendance >= threshold,
          eligibilityOverride: input.eligibilityOverride ?? false,
          status: toStatus(input.status) ?? 'ACTIVE',
        },
      },
    },
    include: { student: { include: studentInclude } },
  })

  await audit(ctx, {
    action: 'student.created',
    entityType: 'student',
    entityId: user.student!.id,
    summary: `Added student ${input.rollNumber} (${fullName(user)})`,
  })
  return { student: toStudentDto(user.student!), temporaryPassword }
}

export async function updateStudent(ctx: AuthContext, id: string, input: StudentUpdateInput): Promise<Student> {
  const existing = await prisma.student.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: {
      departmentId: true,
      courseId: true,
      eligibilityOverride: true,
      attendancePercentage: true,
      isEligible: true,
    },
  })
  if (!existing) throw notFound('Student not found')

  if (input.departmentId || input.courseId) {
    await assertDepartmentAndCourse(
      ctx.organizationId,
      input.departmentId ?? existing.departmentId,
      input.courseId ?? existing.courseId
    )
  }

  // Recompute eligibility from attendance unless the caller set it or an admin override is in place.
  let isEligible = input.isEligible
  const override = input.eligibilityOverride ?? existing.eligibilityOverride
  const overrideRemoved = existing.eligibilityOverride && input.eligibilityOverride === false
  if (isEligible === undefined && !override && (input.attendancePercentage !== undefined || overrideRemoved)) {
    const attendance = input.attendancePercentage ?? existing.attendancePercentage
    isEligible = attendance >= (await minimumAttendance(ctx.organizationId))
  }

  const updated = await prisma.student.update({
    where: { id },
    data: {
      rollNumber: input.rollNumber,
      registrationNumber: input.registrationNumber,
      department: input.departmentId ? { connect: { id: input.departmentId } } : undefined,
      course: input.courseId ? { connect: { id: input.courseId } } : undefined,
      currentSemester: input.currentSemester,
      section: input.section,
      batchYear: input.batchYear,
      gender: toGender(input.gender),
      dateOfBirth: parseOptionalDate(input.dateOfBirth),
      bloodGroup: input.bloodGroup,
      phone: input.phone,
      admissionDate: parseOptionalDate(input.admissionDate),
      address: input.address,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      attendancePercentage: input.attendancePercentage,
      isEligible,
      eligibilityOverride: input.eligibilityOverride,
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
    include: studentInclude,
  })

  const details: string[] = []
  if (input.attendancePercentage !== undefined && input.attendancePercentage !== existing.attendancePercentage) {
    details.push(`attendance ${existing.attendancePercentage}% → ${input.attendancePercentage}%`)
  }
  if (updated.isEligible !== existing.isEligible) details.push(updated.isEligible ? 'now eligible' : 'now ineligible')
  if (input.eligibilityOverride !== undefined && input.eligibilityOverride !== existing.eligibilityOverride) {
    details.push(input.eligibilityOverride ? 'eligibility override on' : 'eligibility override off')
  }
  await audit(ctx, {
    action: 'student.updated',
    entityType: 'student',
    entityId: id,
    summary: `Updated student ${updated.rollNumber} (${fullName(updated.user)})${details.length ? `: ${details.join(', ')}` : ''}`,
  })
  return toStudentDto(updated)
}

export async function resetStudentPassword(ctx: AuthContext, id: string, password?: string) {
  const student = await prisma.student.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: { userId: true, rollNumber: true },
  })
  if (!student) throw notFound('Student not found')
  const result = await resetUserPassword(student.userId, password)
  await audit(ctx, {
    action: 'student.password-reset',
    entityType: 'student',
    entityId: id,
    summary: `Reset the password of student ${student.rollNumber}`,
  })
  return result
}

/** Deletes the student's login account; the profile and seat allocations cascade with it. */
export async function deleteStudent(ctx: AuthContext, id: string): Promise<void> {
  const student = await prisma.student.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: { userId: true, rollNumber: true, user: { select: { firstName: true, lastName: true } } },
  })
  if (!student) throw notFound('Student not found')
  await prisma.user.delete({ where: { id: student.userId } })
  await audit(ctx, {
    action: 'student.deleted',
    entityType: 'student',
    entityId: id,
    summary: `Deleted student ${student.rollNumber} (${fullName(student.user)})`,
  })
}

// ─── Bulk import ────────────────────────────────────────────────────────────

const GENDER_ALIAS: Record<string, Gender> = { male: 'MALE', m: 'MALE', female: 'FEMALE', f: 'FEMALE', other: 'OTHER' }

type StudentImportRow = z.infer<typeof studentImportRowSchema>

/**
 * Creates student accounts from spreadsheet rows. Every row is validated
 * first; rows with errors are reported and skipped, the rest are created
 * together. With `validateOnly`, nothing is written.
 */
export async function importStudents(ctx: AuthContext, input: z.infer<typeof importSchema>): Promise<ImportResult> {
  const [departments, courses, threshold] = await Promise.all([
    prisma.department.findMany({ where: { organizationId: ctx.organizationId }, select: { id: true, code: true, name: true } }),
    prisma.course.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, code: true, name: true, departmentId: true },
    }),
    minimumAttendance(ctx.organizationId),
  ])
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
  const findDepartment = (v: string) => departments.find((d) => same(d.code, v) || same(d.name, v))
  const findCourse = (v: string, departmentId: string) =>
    courses.find((c) => c.departmentId === departmentId && (same(c.code, v) || same(c.name, v)))

  const errors: ImportResult['errors'] = []
  const valid: { row: number; data: StudentImportRow; departmentId: string; courseId: string }[] = []
  const seenEmail = new Map<string, number>()
  const seenRoll = new Map<string, number>()
  const seenReg = new Map<string, number>()

  input.rows.forEach((raw, i) => {
    const row = i + 1
    const parsed = studentImportRowSchema.safeParse(canonicalizeRow(raw, STUDENT_IMPORT_COLUMNS))
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
    const course = findCourse(data.course, department.id)
    if (!course) {
      errors.push({ row, message: `Course “${data.course}” does not exist in ${department.name}` })
      return
    }

    const roll = data.rollNumber.toLowerCase()
    const reg = data.registrationNumber?.toLowerCase()
    const dupes: string[] = []
    if (seenEmail.has(data.email)) dupes.push(`email repeats row ${seenEmail.get(data.email)}`)
    if (seenRoll.has(roll)) dupes.push(`roll number repeats row ${seenRoll.get(roll)}`)
    if (reg && seenReg.has(reg)) dupes.push(`registration number repeats row ${seenReg.get(reg)}`)
    if (dupes.length) {
      errors.push({ row, message: dupes.join('; ') })
      return
    }
    seenEmail.set(data.email, row)
    seenRoll.set(roll, row)
    if (reg) seenReg.set(reg, row)
    valid.push({ row, data, departmentId: department.id, courseId: course.id })
  })

  // Clashes with existing accounts.
  if (valid.length) {
    const regNumbers = valid.flatMap((v) => (v.data.registrationNumber ? [v.data.registrationNumber] : []))
    const [users, rolls, regs] = await Promise.all([
      prisma.user.findMany({
        where: { organizationId: ctx.organizationId, email: { in: valid.map((v) => v.data.email) } },
        select: { email: true },
      }),
      prisma.student.findMany({
        where: { organizationId: ctx.organizationId, rollNumber: { in: valid.map((v) => v.data.rollNumber), mode: 'insensitive' } },
        select: { rollNumber: true },
      }),
      regNumbers.length
        ? prisma.student.findMany({
            where: { organizationId: ctx.organizationId, registrationNumber: { in: regNumbers, mode: 'insensitive' } },
            select: { registrationNumber: true },
          })
        : Promise.resolve([]),
    ])
    const takenEmail = new Set(users.map((u) => u.email))
    const takenRoll = new Set(rolls.map((r) => r.rollNumber.toLowerCase()))
    const takenReg = new Set(regs.map((r) => (r.registrationNumber ?? '').toLowerCase()))
    for (let i = valid.length - 1; i >= 0; i--) {
      const { row, data } = valid[i]
      const clashes: string[] = []
      if (takenEmail.has(data.email)) clashes.push('an account with this email already exists')
      if (takenRoll.has(data.rollNumber.toLowerCase())) clashes.push('this roll number already exists')
      if (data.registrationNumber && takenReg.has(data.registrationNumber.toLowerCase())) {
        clashes.push('this registration number already exists')
      }
      if (clashes.length) {
        errors.push({ row, message: clashes.join('; ') })
        valid.splice(i, 1)
      }
    }
  }
  errors.sort((a, b) => a.row - b.row)

  const result: ImportResult = { total: input.rows.length, created: 0, failed: errors.length, errors, validateOnly: input.validateOnly }
  if (input.validateOnly || !valid.length) return result

  // One hash for the shared initial password keeps a 2,000-row import fast.
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
            role: 'STUDENT' as const,
          })),
          select: { id: true, email: true },
        })
        const userIdByEmail = new Map(users.map((u) => [u.email, u.id]))
        await tx.student.createMany({
          data: chunk.map(({ data, departmentId, courseId }) => ({
            organizationId: ctx.organizationId,
            userId: userIdByEmail.get(data.email)!,
            rollNumber: data.rollNumber,
            registrationNumber: data.registrationNumber,
            departmentId,
            courseId,
            currentSemester: data.semester,
            section: data.section,
            batchYear: data.batchYear,
            gender: GENDER_ALIAS[data.gender],
            phone: data.phone,
            dateOfBirth: data.dateOfBirth ? parseDateOnly(data.dateOfBirth) : undefined,
            // New students have not missed any classes yet.
            attendancePercentage: 100,
            isEligible: 100 >= threshold,
          })),
        })
      }
    },
    { timeout: 60_000 }
  )

  result.created = valid.length
  const skipped = errors.length ? ` (${errors.length} row${errors.length === 1 ? '' : 's'} skipped)` : ''
  await audit(ctx, {
    action: 'student.imported',
    entityType: 'student',
    summary: `Imported ${valid.length} student${valid.length === 1 ? '' : 's'} from a spreadsheet${skipped}`,
    metadata: { created: valid.length, skipped: errors.length },
  })
  return result
}
