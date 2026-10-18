import type { ExamStatus, ExamType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isAdminRole } from '@/lib/auth/roles'
import type { Exam } from '@/types/exam.types'
import { audit } from '../audit'
import { badRequest, notFound } from '../http'
import { examInclude, parseDateOnly, toDateOnly, toExamDto } from '../mappers'
import { todayInTimeZone } from '../scheduling/time'
import type { AuthContext } from '../session'
import type { ExamCreateInput, ExamListQuery, ExamSessionInput, ExamSessionUpdateInput, ExamUpdateInput } from '../validation'

const toType = (t: string | undefined) => t?.toUpperCase() as ExamType | undefined

/** Draft exams are internal to administrators. */
function visibility(ctx: AuthContext): Prisma.ExamWhereInput {
  return isAdminRole(ctx.role) ? {} : { status: { not: 'DRAFT' } }
}

// ─── Calendar-driven status ─────────────────────────────────────────────────

const lastSync = new Map<string, number>()
const SYNC_INTERVAL_MS = 60_000

/** "Today" in the organization's timezone, as YYYY-MM-DD. */
export async function organizationToday(organizationId: string): Promise<string> {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { timezone: true } })
  return todayInTimeZone(org.timezone)
}

/**
 * Moves published exams between scheduled → ongoing → completed according to
 * today's date in the organization's timezone. Drafts and cancelled exams are
 * never touched. Runs at most once a minute per organization unless forced.
 */
export async function syncExamStatuses(organizationId: string, force = false): Promise<void> {
  const now = Date.now()
  if (!force && now - (lastSync.get(organizationId) ?? 0) < SYNC_INTERVAL_MS) return
  lastSync.set(organizationId, now)

  const today = parseDateOnly(await organizationToday(organizationId))
  const published: ExamStatus[] = ['SCHEDULED', 'ONGOING', 'COMPLETED']
  await prisma.$transaction([
    prisma.exam.updateMany({
      where: { organizationId, status: { in: published, not: 'SCHEDULED' }, startDate: { gt: today } },
      data: { status: 'SCHEDULED' },
    }),
    prisma.exam.updateMany({
      where: { organizationId, status: { in: published, not: 'ONGOING' }, startDate: { lte: today }, endDate: { gte: today } },
      data: { status: 'ONGOING' },
    }),
    prisma.exam.updateMany({
      where: { organizationId, status: { in: published, not: 'COMPLETED' }, endDate: { lt: today } },
      data: { status: 'COMPLETED' },
    }),
  ])
}

/** Maps a requested status to what is stored: anything "published" is stored as SCHEDULED and then synced. */
function requestedStatus(status: string | undefined): ExamStatus | undefined {
  if (!status) return undefined
  if (status === 'draft') return 'DRAFT'
  if (status === 'cancelled') return 'CANCELLED'
  return 'SCHEDULED'
}

// ─── Exams ──────────────────────────────────────────────────────────────────

export async function listExams(ctx: AuthContext, q: ExamListQuery): Promise<{ rows: Exam[]; total: number }> {
  await syncExamStatuses(ctx.organizationId)
  const where: Prisma.ExamWhereInput = {
    organizationId: ctx.organizationId,
    examType: toType(q.examType),
    semester: q.semester,
    name: q.search ? { contains: q.search, mode: 'insensitive' } : undefined,
    AND: [visibility(ctx)],
  }
  if (q.status && q.status !== 'all') where.status = q.status.toUpperCase() as ExamStatus

  const [total, rows] = await prisma.$transaction([
    prisma.exam.count({ where }),
    prisma.exam.findMany({
      where,
      include: examInclude,
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
  ])
  return { rows: rows.map(toExamDto), total }
}

export async function getExam(ctx: AuthContext, id: string): Promise<Exam> {
  await syncExamStatuses(ctx.organizationId)
  const exam = await prisma.exam.findFirst({
    where: { id, organizationId: ctx.organizationId, ...visibility(ctx) },
    include: examInclude,
  })
  if (!exam) throw notFound('Exam not found')
  return toExamDto(exam)
}

function sessionData(organizationId: string, s: ExamSessionInput) {
  const subjectCode = s.subjectCode ?? s.subjectId
  return {
    organizationId,
    subjectName: s.subjectName || subjectCode!,
    subjectCode,
    examDate: parseDateOnly(s.examDate),
    startTime: s.startTime,
    endTime: s.endTime,
    durationMinutes: s.durationMinutes,
    maximumMarks: s.maximumMarks ?? 100,
    passingMarks: s.passingMarks ?? 40,
  }
}

function assertWithinExam(examDate: string, startDate: string, endDate: string) {
  if (examDate < startDate || examDate > endDate) {
    throw badRequest(`examDate: The paper must be scheduled between ${startDate} and ${endDate}`)
  }
}

export async function createExam(ctx: AuthContext, input: ExamCreateInput): Promise<Exam> {
  input.subjects?.forEach((s) => assertWithinExam(s.examDate, input.startDate, input.endDate))
  const exam = await prisma.exam.create({
    data: {
      organizationId: ctx.organizationId,
      name: input.name,
      examType: toType(input.examType)!,
      academicYear: input.academicYear,
      semester: input.semester,
      startDate: parseDateOnly(input.startDate),
      endDate: parseDateOnly(input.endDate),
      description: input.description,
      instructions: input.instructions,
      status: 'DRAFT',
      createdById: ctx.userId,
      sessions: input.subjects?.length
        ? { create: input.subjects.map((s) => sessionData(ctx.organizationId, s)) }
        : undefined,
    },
    include: examInclude,
  })
  await audit(ctx, { action: 'exam.created', entityType: 'exam', entityId: exam.id, summary: `Created exam “${exam.name}” as a draft` })
  return toExamDto(exam)
}

export async function updateExam(ctx: AuthContext, id: string, input: ExamUpdateInput): Promise<Exam> {
  const existing = await prisma.exam.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: { name: true, status: true, startDate: true, endDate: true },
  })
  if (!existing) throw notFound('Exam not found')

  const startDate = input.startDate ?? toDateOnly(existing.startDate)
  const endDate = input.endDate ?? toDateOnly(existing.endDate)
  if (endDate < startDate) throw badRequest('endDate: End date cannot be before start date')

  const status = requestedStatus(input.status)
  await prisma.exam.update({
    where: { id },
    data: {
      name: input.name,
      examType: toType(input.examType),
      academicYear: input.academicYear,
      semester: input.semester,
      startDate: input.startDate ? parseDateOnly(input.startDate) : undefined,
      endDate: input.endDate ? parseDateOnly(input.endDate) : undefined,
      description: input.description,
      instructions: input.instructions,
      status,
    },
  })
  // Dates or publication may change the calendar status.
  await syncExamStatuses(ctx.organizationId, true)

  const wasPublished = existing.status !== 'DRAFT' && existing.status !== 'CANCELLED'
  const verb =
    status === 'CANCELLED' && existing.status !== 'CANCELLED'
      ? 'Cancelled'
      : status === 'SCHEDULED' && !wasPublished
        ? 'Published'
        : status === 'DRAFT' && existing.status !== 'DRAFT'
          ? 'Moved to draft'
          : 'Updated'
  await audit(ctx, {
    action: `exam.${verb.toLowerCase().replace(/ /g, '-')}`,
    entityType: 'exam',
    entityId: id,
    summary: `${verb} exam “${input.name ?? existing.name}”`,
  })
  return getExam(ctx, id)
}

/** Deletes the exam with its papers, seat allocations and invigilation duties. */
export async function deleteExam(ctx: AuthContext, id: string): Promise<void> {
  const exam = await prisma.exam.findFirst({ where: { id, organizationId: ctx.organizationId }, select: { name: true } })
  if (!exam) throw notFound('Exam not found')
  await prisma.exam.delete({ where: { id } })
  await audit(ctx, { action: 'exam.deleted', entityType: 'exam', entityId: id, summary: `Deleted exam “${exam.name}”` })
}

// ─── Papers (exam sessions) ─────────────────────────────────────────────────

async function findExamForPapers(ctx: AuthContext, examId: string) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, organizationId: ctx.organizationId },
    select: { id: true, name: true, startDate: true, endDate: true },
  })
  if (!exam) throw notFound('Exam not found')
  return exam
}

export async function addExamSession(ctx: AuthContext, examId: string, input: ExamSessionInput): Promise<Exam> {
  const exam = await findExamForPapers(ctx, examId)
  assertWithinExam(input.examDate, toDateOnly(exam.startDate), toDateOnly(exam.endDate))
  const data = sessionData(ctx.organizationId, input)
  await prisma.examSession.create({ data: { ...data, examId } })
  await audit(ctx, {
    action: 'exam.paper-added',
    entityType: 'exam',
    entityId: examId,
    summary: `Added paper “${data.subjectName}” (${input.examDate} ${input.startTime}) to “${exam.name}”`,
  })
  return getExam(ctx, examId)
}

export async function updateExamSession(ctx: AuthContext, examId: string, sessionId: string, input: ExamSessionUpdateInput): Promise<Exam> {
  const exam = await findExamForPapers(ctx, examId)
  const session = await prisma.examSession.findFirst({ where: { id: sessionId, examId } })
  if (!session) throw notFound('Paper not found')

  const startTime = input.startTime ?? session.startTime
  const endTime = input.endTime ?? session.endTime
  if (endTime <= startTime) throw badRequest('endTime: End time must be after start time')
  if (input.examDate) assertWithinExam(input.examDate, toDateOnly(exam.startDate), toDateOnly(exam.endDate))
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)

  await prisma.examSession.update({
    where: { id: sessionId },
    data: {
      subjectName: input.subjectName,
      subjectCode: input.subjectCode,
      examDate: input.examDate ? parseDateOnly(input.examDate) : undefined,
      startTime: input.startTime,
      endTime: input.endTime,
      durationMinutes: eh * 60 + em - (sh * 60 + sm),
      maximumMarks: input.maximumMarks,
      passingMarks: input.passingMarks,
    },
  })
  await audit(ctx, {
    action: 'exam.paper-updated',
    entityType: 'exam',
    entityId: examId,
    summary: `Updated paper “${input.subjectName ?? session.subjectName}” of “${exam.name}”`,
  })
  return getExam(ctx, examId)
}

/** Removes a paper together with its seating and duties. */
export async function deleteExamSession(ctx: AuthContext, examId: string, sessionId: string): Promise<Exam> {
  const exam = await findExamForPapers(ctx, examId)
  const session = await prisma.examSession.findFirst({ where: { id: sessionId, examId }, select: { subjectName: true } })
  if (!session) throw notFound('Paper not found')
  await prisma.examSession.delete({ where: { id: sessionId } })
  await audit(ctx, {
    action: 'exam.paper-deleted',
    entityType: 'exam',
    entityId: examId,
    summary: `Removed paper “${session.subjectName}” from “${exam.name}”`,
  })
  return getExam(ctx, examId)
}
