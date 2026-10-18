import type { AllocationAlgorithm as DbAlgorithm, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isAdminRole } from '@/lib/auth/roles'
import { signHallTicketToken } from '@/lib/auth/jwt'
import type { AllocationResult, MySeatResponse, SeatAllocation } from '@/types/seat.types'
import {
  applyAlternateSpacing,
  assignSeats,
  capSeatsPerRoom,
  countAdjacentSameDepartment,
  seatLabel,
  type SeatSlot,
  type SeatStudent,
} from '../allocation/seat-algorithms'
import { audit } from '../audit'
import { conflict, notFound } from '../http'
import {
  DUTY_ROLE_LABEL,
  allocationInclude,
  fullName,
  studentInclude,
  toAllocationDto,
  toDateOnly,
  toStudentDto,
} from '../mappers'
import { slotsOverlap } from '../scheduling/time'
import type { AuthContext } from '../session'
import type { AllocateSeatsInput } from '../validation'
import { syncExamStatuses } from './exams.service'

const sessionSelect = { id: true, subjectName: true, examDate: true, startTime: true, endTime: true } as const
const allocationWithContext = {
  ...allocationInclude,
  exam: { select: { name: true } },
  session: { select: sessionSelect },
} satisfies Prisma.SeatAllocationInclude

const seatOrder: Prisma.SeatAllocationOrderByWithRelationInput[] = [
  { room: { name: 'asc' } },
  { bench: { row: 'asc' } },
  { bench: { column: 'asc' } },
  { seatPosition: 'asc' },
]

const ALLOCATABLE = ['SCHEDULED', 'ONGOING'] as const

/** Seating plans grouped per paper, in date/time order. */
export async function listAllocations(ctx: AuthContext, q: { examId?: string; sessionId?: string } = {}): Promise<SeatAllocation[]> {
  const rows = await prisma.seatAllocation.findMany({
    where: { organizationId: ctx.organizationId, examId: q.examId, sessionId: q.sessionId },
    include: allocationWithContext,
    orderBy: [{ session: { examDate: 'asc' } }, { session: { startTime: 'asc' } }, ...seatOrder],
  })

  const groups = new Map<string, SeatAllocation>()
  rows.forEach((row) => {
    let group = groups.get(row.sessionId)
    if (!group) {
      group = {
        id: row.sessionId,
        examId: row.examId,
        examName: row.exam.name,
        sessionId: row.sessionId,
        subjectName: row.session.subjectName,
        examDate: toDateOnly(row.session.examDate),
        startTime: row.session.startTime,
        endTime: row.session.endTime,
        allocations: [],
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }
      groups.set(row.sessionId, group)
    }
    group.allocations.push(toAllocationDto(row))
    if (row.updatedAt.toISOString() > group.updatedAt) group.updatedAt = row.updatedAt.toISOString()
  })
  return Array.from(groups.values())
}

/** Lightweight counts for dashboards: per exam, and per paper and room. */
export async function getAllocationSummary(ctx: AuthContext) {
  const [exams, rooms] = await Promise.all([
    prisma.$queryRaw<{ examId: string; students: number; seats: number; papers: number }[]>`
      SELECT "examId",
             COUNT(DISTINCT "studentId")::int AS students,
             COUNT(*)::int AS seats,
             COUNT(DISTINCT "sessionId")::int AS papers
      FROM "SeatAllocation"
      WHERE "organizationId" = ${ctx.organizationId}
      GROUP BY "examId"`,
    prisma.seatAllocation.groupBy({
      by: ['examId', 'sessionId', 'roomId'],
      where: { organizationId: ctx.organizationId },
      _count: { _all: true },
    }),
  ])
  return {
    exams,
    rooms: rooms.map((r) => ({ examId: r.examId, sessionId: r.sessionId, roomId: r.roomId, count: r._count._all })),
  }
}

export async function allocateSeats(ctx: AuthContext, input: AllocateSeatsInput): Promise<AllocationResult> {
  const { organizationId } = ctx
  const result: AllocationResult = {
    totalStudents: input.studentIds?.length ?? 0,
    allocatedStudents: 0,
    failedAllocations: 0,
    allocations: [],
    errors: [],
    algorithm: input.algorithm,
    adjacentSameDeptPairs: 0,
    sessionIds: [],
  }

  await syncExamStatuses(organizationId)
  const exam = await prisma.exam.findFirst({
    where: { id: input.examId, organizationId },
    include: { sessions: { select: sessionSelect, orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }] } },
  })
  if (!exam) throw notFound('Exam not found')
  if (!(ALLOCATABLE as readonly string[]).includes(exam.status)) {
    throw conflict(
      exam.status === 'COMPLETED'
        ? 'This exam has finished, so its seating can no longer change.'
        : 'Publish the exam (status "scheduled") before allocating seats',
      'EXAM_NOT_PUBLISHED'
    )
  }
  if (exam.sessions.length === 0) {
    throw conflict('Add at least one paper (subject) to this exam before seating students.', 'NO_PAPERS')
  }

  // ── Papers ──
  const targets = input.sessionIds ? exam.sessions.filter((s) => input.sessionIds!.includes(s.id)) : exam.sessions
  if (input.sessionIds && targets.length !== new Set(input.sessionIds).size) {
    throw notFound('One or more of the selected papers do not belong to this exam')
  }
  const targetIds = targets.map((s) => s.id)
  result.sessionIds = targetIds

  const marked = await prisma.seatAllocation.count({ where: { sessionId: { in: targetIds }, attendanceStatus: { not: null } } })
  if (marked) {
    throw conflict(
      `Attendance has already been recorded for ${marked} seat${marked === 1 ? '' : 's'} in the selected paper(s), so their seating can't be replaced.`,
      'ATTENDANCE_RECORDED'
    )
  }

  // ── Students ──
  let students: SeatStudent[] = []
  if (input.selection) {
    const found = await prisma.student.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        isEligible: true,
        departmentId: input.selection.departmentIds?.length ? { in: input.selection.departmentIds } : undefined,
        currentSemester: input.selection.semesters?.length ? { in: input.selection.semesters } : undefined,
      },
      select: { id: true, rollNumber: true, departmentId: true },
    })
    students = found
    result.totalStudents = found.length
  } else {
    const requestedIds = Array.from(new Set(input.studentIds ?? []))
    const found = await prisma.student.findMany({
      where: { organizationId, id: { in: requestedIds } },
      select: { id: true, rollNumber: true, departmentId: true, isEligible: true, status: true },
    })
    const byId = new Map(found.map((s) => [s.id, s]))
    requestedIds.forEach((id) => {
      const s = byId.get(id)
      if (!s) result.errors.push({ studentId: id, error: 'Student not found' })
      else if (!s.isEligible || s.status !== 'ACTIVE') {
        result.errors.push({ studentId: id, error: `${s.rollNumber} is not eligible for this exam` })
      } else students.push({ id: s.id, rollNumber: s.rollNumber, departmentId: s.departmentId })
    })
  }

  // ── Other papers at overlapping times (any exam that is still live) ──
  const targetSlots = targets.map((s) => ({ examDate: toDateOnly(s.examDate), startTime: s.startTime, endTime: s.endTime }))
  const sameDay = await prisma.examSession.findMany({
    where: {
      organizationId,
      id: { notIn: targetIds },
      examDate: { in: targets.map((s) => s.examDate) },
      exam: { status: { in: [...ALLOCATABLE] } },
    },
    select: { id: true, subjectName: true, examDate: true, startTime: true, endTime: true },
  })
  const overlapping = sameDay.filter((o) =>
    targetSlots.some((t) => slotsOverlap(t, { examDate: toDateOnly(o.examDate), startTime: o.startTime, endTime: o.endTime }))
  )
  const busy = overlapping.length
    ? await prisma.seatAllocation.findMany({
        where: { sessionId: { in: overlapping.map((o) => o.id) } },
        select: { studentId: true, benchId: true, seatPosition: true, sessionId: true },
      })
    : []

  // A student can't sit two papers at once.
  const clashPaper = new Map<string, string>()
  const paperName = new Map(overlapping.map((o) => [o.id, o.subjectName]))
  busy.forEach((b) => clashPaper.set(b.studentId, paperName.get(b.sessionId) ?? 'another paper'))
  students = students.filter((s) => {
    const clash = clashPaper.get(s.id)
    if (clash) result.errors.push({ studentId: s.id, error: `${s.rollNumber} is already seated for “${clash}” at the same time` })
    return !clash
  })

  result.failedAllocations = result.errors.length
  if (students.length === 0) {
    if (result.errors.length === 0) result.errors.push({ studentId: 'system', error: 'No eligible students match the selection' })
    return result
  }

  // ── Seats ──
  const rooms = await prisma.room.findMany({
    where: { organizationId, isAvailable: true, id: input.roomIds?.length ? { in: input.roomIds } : undefined },
    select: {
      id: true,
      name: true,
      benches: { where: { isActive: true }, select: { id: true, row: true, column: true, seatsPerBench: true } },
    },
  })
  const busyKeys = new Set(busy.map((b) => `${b.benchId}:${b.seatPosition}`))

  let seats: SeatSlot[] = []
  rooms.forEach((room) => {
    room.benches.forEach((bench) => {
      for (let pos = 1; pos <= bench.seatsPerBench; pos++) {
        if (busyKeys.has(`${bench.id}:${pos}`)) continue
        seats.push({
          benchId: bench.id,
          roomId: room.id,
          roomName: room.name,
          row: bench.row,
          column: bench.column,
          seatPosition: pos,
          seatsPerBench: bench.seatsPerBench,
        })
      }
    })
  })
  if (input.spacingMode === 'alternate') seats = applyAlternateSpacing(seats)
  if (input.maxStudentsPerRoom) seats = capSeatsPerRoom(seats, input.maxStudentsPerRoom)

  if (seats.length < students.length) {
    const note = busyKeys.size > 0 ? ' Seats used by other papers at the same time are excluded.' : ''
    result.errors.push({
      studentId: 'system',
      error: `Not enough benches available (${seats.length} free, need ${students.length}).${note}`,
    })
    result.failedAllocations += students.length
    return result
  }

  // ── Assign once, persist for every selected paper (replacing previous plans) ──
  const assignments = assignSeats(input.algorithm, students, seats)
  const algorithm = input.algorithm.toUpperCase() as DbAlgorithm
  const rowsFor = (sessionId: string): Prisma.SeatAllocationCreateManyInput[] =>
    assignments.map(({ student, seat }) => ({
      organizationId,
      examId: exam.id,
      sessionId,
      studentId: student.id,
      roomId: seat.roomId,
      benchId: seat.benchId,
      seatPosition: seat.seatPosition,
      seatLabel: seatLabel(seat),
      algorithm,
    }))

  await prisma.$transaction(
    async (tx) => {
      await tx.seatAllocation.deleteMany({ where: { organizationId, sessionId: { in: targetIds } } })
      for (const sessionId of targetIds) {
        const data = rowsFor(sessionId)
        for (let i = 0; i < data.length; i += 5000) await tx.seatAllocation.createMany({ data: data.slice(i, i + 5000) })
      }
    },
    { timeout: 60_000 }
  )

  const [saved] = await listAllocations(ctx, { sessionId: targetIds[0] })
  result.allocations = saved?.allocations ?? []
  result.allocatedStudents = assignments.length
  result.failedAllocations += students.length - assignments.length
  result.adjacentSameDeptPairs = countAdjacentSameDepartment(assignments)

  await audit(ctx, {
    action: 'seating.allocated',
    entityType: 'exam',
    entityId: exam.id,
    summary: `Seated ${assignments.length} students for “${exam.name}” (${targets.length === exam.sessions.length && targets.length > 1 ? 'all papers' : targets.map((t) => t.subjectName).join(', ')}) using ${input.algorithm.replace(/_/g, ' ')}`,
    metadata: { algorithm: input.algorithm, papers: targetIds.length, students: assignments.length, rooms: new Set(assignments.map((a) => a.seat.roomId)).size },
  })
  return result
}

/** Clears seating for one paper, or for the whole exam when no paper is given. */
export async function clearAllocation(ctx: AuthContext, examId: string, sessionId?: string): Promise<number> {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, organizationId: ctx.organizationId },
    select: { id: true, name: true },
  })
  if (!exam) throw notFound('Exam not found')
  const paper = sessionId
    ? await prisma.examSession.findFirst({ where: { id: sessionId, examId }, select: { subjectName: true } })
    : null
  if (sessionId && !paper) throw notFound('Paper not found')

  const { count } = await prisma.seatAllocation.deleteMany({ where: { organizationId: ctx.organizationId, examId, sessionId } })
  await audit(ctx, {
    action: 'seating.cleared',
    entityType: 'exam',
    entityId: examId,
    summary: `Cleared ${count} seats for “${exam.name}”${paper ? ` (${paper.subjectName})` : ''}`,
  })
  return count
}

/**
 * A student's seats across published exams, per paper, with each room's
 * invigilators. Students always get their own record; admins may preview any student.
 */
export async function getMySeat(ctx: AuthContext, studentId?: string): Promise<MySeatResponse> {
  await syncExamStatuses(ctx.organizationId)
  const admin = isAdminRole(ctx.role)
  const student = await prisma.student.findFirst({
    where: { organizationId: ctx.organizationId, ...(admin ? { id: studentId } : { userId: ctx.userId }) },
    include: studentInclude,
    orderBy: { rollNumber: 'asc' },
  })
  if (!student) throw notFound(admin ? 'Student not found' : 'No student profile is linked to this account')

  const rows = await prisma.seatAllocation.findMany({
    where: { organizationId: ctx.organizationId, studentId: student.id, exam: { status: { not: 'DRAFT' } } },
    include: allocationWithContext,
    orderBy: [{ session: { examDate: 'asc' } }, { session: { startTime: 'asc' } }],
  })

  const duties = rows.length
    ? await prisma.invigilationDuty.findMany({
        where: { organizationId: ctx.organizationId, OR: rows.map((r) => ({ sessionId: r.sessionId, roomId: r.roomId })) },
        select: {
          sessionId: true,
          roomId: true,
          role: true,
          teacher: { select: { employeeId: true, user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { role: 'asc' },
      })
    : []

  const examIds = Array.from(new Set(rows.map((r) => r.examId)))
  const hallTickets = await Promise.all(
    examIds.map(async (examId) => ({
      examId,
      token: await signHallTicketToken({ studentId: student.id, examId, organizationId: ctx.organizationId }),
    }))
  )

  return {
    student: toStudentDto(student),
    hallTickets,
    allocations: rows.map((r) => ({
      ...toAllocationDto(r),
      examId: r.examId,
      examName: r.exam.name,
      sessionId: r.sessionId,
      subjectName: r.session.subjectName,
      examDate: toDateOnly(r.session.examDate),
      startTime: r.session.startTime,
      endTime: r.session.endTime,
      invigilators: duties
        .filter((d) => d.sessionId === r.sessionId && d.roomId === r.roomId)
        .map((d) => ({
          teacherName: fullName(d.teacher.user),
          employeeId: d.teacher.employeeId,
          role: DUTY_ROLE_LABEL[d.role],
        })),
    })),
  }
}
