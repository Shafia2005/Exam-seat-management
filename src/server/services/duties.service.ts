import type { ExamStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isAdminRole } from '@/lib/auth/roles'
import type {
  AttendanceCounts,
  AutoAllocateDutiesResult,
  ExamDutyRoster,
  MyDutiesResponse,
  RoomTeacherDuty,
  TeacherWorkloadStat,
} from '@/types/teacherDuty.types'
import { planDuties, type PlannerRoom, type PlannerTeacher } from '../allocation/duty-planner'
import { audit } from '../audit'
import { conflict, notFound } from '../http'
import {
  DUTY_ROLE_FROM_LABEL,
  DUTY_ROLE_LABEL,
  dutyInclude,
  fullName,
  teacherInclude,
  toDateOnly,
  toDutyDto,
  toTeacherDto,
} from '../mappers'
import { slotLabel, slotsOverlap, type TimeSlot } from '../scheduling/time'
import type { AuthContext } from '../session'
import type { AssignDutyInput, AutoAllocateDutiesInput } from '../validation'
import { organizationToday, syncExamStatuses } from './exams.service'

const dutyOrder: Prisma.InvigilationDutyOrderByWithRelationInput[] = [{ room: { name: 'asc' } }, { role: 'asc' }]

const sessionSelect = {
  id: true,
  examId: true,
  subjectName: true,
  examDate: true,
  startTime: true,
  endTime: true,
  exam: { select: { id: true, name: true, status: true } },
} satisfies Prisma.ExamSessionSelect

const slotOf = (s: { examDate: Date; startTime: string; endTime: string }): TimeSlot => ({
  examDate: toDateOnly(s.examDate),
  startTime: s.startTime,
  endTime: s.endTime,
})

async function findSession(ctx: AuthContext, sessionId: string) {
  const session = await prisma.examSession.findFirst({
    where: { id: sessionId, organizationId: ctx.organizationId },
    select: sessionSelect,
  })
  if (!session) throw notFound('Paper not found')
  return session
}

/** Completed and cancelled exams keep their roster for the record but can't be changed. */
function assertEditable(status: ExamStatus) {
  if (status === 'COMPLETED' || status === 'CANCELLED') {
    throw conflict(`This exam is ${status.toLowerCase()}, so its invigilation roster can no longer change.`, 'EXAM_LOCKED')
  }
}

/** Students seated per room for one paper. */
async function seatedCounts(organizationId: string, sessionId: string): Promise<Map<string, number>> {
  const groups = await prisma.seatAllocation.groupBy({
    by: ['roomId'],
    where: { organizationId, sessionId },
    _count: { _all: true },
  })
  return new Map(groups.map((g) => [g.roomId, g._count._all]))
}

export async function getDutyRoster(ctx: AuthContext, sessionId: string): Promise<ExamDutyRoster> {
  await syncExamStatuses(ctx.organizationId)
  const session = await findSession(ctx, sessionId)
  const [duties, counts] = await Promise.all([
    prisma.invigilationDuty.findMany({
      where: { organizationId: ctx.organizationId, sessionId },
      include: dutyInclude,
      orderBy: dutyOrder,
    }),
    seatedCounts(ctx.organizationId, sessionId),
  ])

  const staffedRooms = new Set(duties.map((d) => d.roomId))
  const roomsInUse = new Set(Array.from(counts.keys()).concat(Array.from(staffedRooms)))
  return {
    examId: session.examId,
    examName: session.exam.name,
    sessionId,
    subjectName: session.subjectName,
    startTime: session.startTime,
    endTime: session.endTime,
    examDate: toDateOnly(session.examDate),
    sessionSlot: slotLabel(session.startTime, session.endTime),
    totalRooms: roomsInUse.size,
    totalAssignedDuties: duties.length,
    unassignedRoomsCount: Array.from(counts.keys()).filter((roomId) => !staffedRooms.has(roomId)).length,
    duties: duties.map((d) => toDutyDto(d, counts.get(d.roomId))),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Duty counts per teacher. With a paper: duties on that paper's date across all
 * exams, plus whether the teacher is busy at an overlapping time. With an exam:
 * duties within that exam.
 */
export async function getTeacherWorkload(ctx: AuthContext, q: { sessionId?: string; examId?: string }): Promise<TeacherWorkloadStat[]> {
  const teachers = await prisma.teacher.findMany({
    where: { organizationId: ctx.organizationId },
    include: teacherInclude,
    orderBy: { employeeId: 'asc' },
  })

  const dutyCount = new Map<string, number>()
  const busy = new Set<string>()
  if (q.sessionId) {
    const session = await findSession(ctx, q.sessionId)
    const slot = slotOf(session)
    const sameDay = await prisma.invigilationDuty.findMany({
      where: { organizationId: ctx.organizationId, session: { examDate: session.examDate } },
      select: { teacherId: true, session: { select: { examDate: true, startTime: true, endTime: true } } },
    })
    sameDay.forEach((d) => {
      dutyCount.set(d.teacherId, (dutyCount.get(d.teacherId) ?? 0) + 1)
      if (slotsOverlap(slot, slotOf(d.session))) busy.add(d.teacherId)
    })
  } else {
    const counts = await prisma.invigilationDuty.groupBy({
      by: ['teacherId'],
      where: { organizationId: ctx.organizationId, examId: q.examId },
      _count: { _all: true },
    })
    counts.forEach((c) => dutyCount.set(c.teacherId, c._count._all))
  }

  return teachers.map((t) => ({
    teacherId: t.id,
    teacherName: fullName(t.user),
    employeeId: t.employeeId,
    departmentName: t.department.name,
    designation: t.designation,
    maxDutiesPerDay: t.maxDuties || 2,
    currentDutiesCount: dutyCount.get(t.id) ?? 0,
    isAvailable: t.isAvailable,
    status: t.status.toLowerCase() as TeacherWorkloadStat['status'],
    busy: q.sessionId ? busy.has(t.id) : undefined,
  }))
}

/**
 * Replaces the roster of the selected papers (default: all papers of the exam)
 * with an automatic one. Daily limits count duties across every exam on the same
 * day, and teachers busy at an overlapping time are skipped. Halls that can't be
 * fully staffed are reported as warnings instead of overloading anyone.
 */
export async function autoAllocateDuties(ctx: AuthContext, input: AutoAllocateDutiesInput): Promise<AutoAllocateDutiesResult> {
  const { organizationId } = ctx
  await syncExamStatuses(organizationId)
  const exam = await prisma.exam.findFirst({
    where: { id: input.examId, organizationId },
    include: { sessions: { orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }] } },
  })
  if (!exam) throw notFound('Exam not found')
  assertEditable(exam.status)
  if (exam.sessions.length === 0) throw conflict('Add at least one paper to this exam first.', 'NO_PAPERS')

  const targets = input.sessionIds ? exam.sessions.filter((s) => input.sessionIds!.includes(s.id)) : exam.sessions
  if (input.sessionIds && targets.length !== new Set(input.sessionIds).size) {
    throw notFound('One or more of the selected papers do not belong to this exam')
  }
  const targetIds = targets.map((s) => s.id)

  // Seated students per paper and room, with each room's dominant department.
  const seated = await prisma.seatAllocation.findMany({
    where: { organizationId, sessionId: { in: targetIds } },
    select: { sessionId: true, roomId: true, student: { select: { department: { select: { name: true } } } } },
  })
  const stats = new Map<string, Map<string, { count: number; depts: Map<string, number> }>>()
  seated.forEach((s) => {
    const rooms = stats.get(s.sessionId) ?? new Map()
    const room = rooms.get(s.roomId) ?? { count: 0, depts: new Map<string, number>() }
    room.count++
    room.depts.set(s.student.department.name, (room.depts.get(s.student.department.name) ?? 0) + 1)
    rooms.set(s.roomId, room)
    stats.set(s.sessionId, rooms)
  })

  const allRooms = await prisma.room.findMany({
    where: { organizationId, id: input.roomIds?.length ? { in: input.roomIds } : undefined },
    select: { id: true, name: true, capacity: true },
    orderBy: { name: 'asc' },
  })
  const roomById = new Map(allRooms.map((r) => [r.id, r]))

  const teacherRows = await prisma.teacher.findMany({
    where: { organizationId, isAvailable: true, status: 'ACTIVE', user: { isActive: true } },
    include: teacherInclude,
    orderBy: { employeeId: 'asc' },
  })
  if (teacherRows.length === 0) throw conflict('No active, available teachers found for allocation.', 'NO_TEACHERS')
  const teachers: PlannerTeacher[] = teacherRows.map((t) => ({
    id: t.id,
    departmentName: t.department.name,
    designation: t.designation,
    maxDuties: t.maxDuties || 2,
  }))

  // Duties on the same days in papers we are not replacing count towards limits and clashes.
  const existing = await prisma.invigilationDuty.findMany({
    where: { organizationId, sessionId: { notIn: targetIds }, session: { examDate: { in: targets.map((s) => s.examDate) } } },
    select: { teacherId: true, session: { select: { examDate: true, startTime: true, endTime: true } } },
  })
  const loadByDate = new Map<string, Map<string, number>>()
  const committed = new Map<string, TimeSlot[]>()
  existing.forEach((d) => {
    const slot = slotOf(d.session)
    const load = loadByDate.get(slot.examDate) ?? new Map<string, number>()
    load.set(d.teacherId, (load.get(d.teacherId) ?? 0) + 1)
    loadByDate.set(slot.examDate, load)
    committed.set(d.teacherId, [...(committed.get(d.teacherId) ?? []), slot])
  })

  const planned: Prisma.InvigilationDutyCreateManyInput[] = []
  const processed: string[] = []
  const warnings: string[] = []

  for (const session of targets) {
    const slot = slotOf(session)
    const sessionStats = stats.get(session.id)
    const roomIds = input.roomIds?.length ? allRooms.map((r) => r.id) : Array.from(sessionStats?.keys() ?? [])
    if (roomIds.length === 0) {
      warnings.push(`“${session.subjectName}”: no seats allocated yet — skipped.`)
      continue
    }
    processed.push(session.id)

    const rooms: PlannerRoom[] = roomIds
      .filter((id) => roomById.has(id))
      .sort((a, b) => roomById.get(a)!.name.localeCompare(roomById.get(b)!.name, undefined, { numeric: true }))
      .map((id) => {
        const s = sessionStats?.get(id)
        let primaryDept: string | undefined
        let max = -1
        s?.depts.forEach((count, dept) => {
          if (count > max) {
            max = count
            primaryDept = dept
          }
        })
        return { id, studentCount: s?.count ?? roomById.get(id)!.capacity, primaryDept }
      })

    const blocked = new Set(
      teachers.filter((t) => (committed.get(t.id) ?? []).some((other) => slotsOverlap(slot, other))).map((t) => t.id)
    )
    const load = loadByDate.get(slot.examDate) ?? new Map<string, number>()
    loadByDate.set(slot.examDate, load)

    const plan = planDuties(rooms, teachers, input, load, blocked)
    plan.duties.forEach((d) => {
      planned.push({ organizationId, examId: exam.id, sessionId: session.id, roomId: d.roomId, teacherId: d.teacherId, role: d.role })
      committed.set(d.teacherId, [...(committed.get(d.teacherId) ?? []), slot])
    })
    plan.shortfalls.forEach((s) =>
      warnings.push(
        `“${session.subjectName}” · ${roomById.get(s.roomId)?.name}: ${s.missing} more invigilator${s.missing === 1 ? '' : 's'} needed — everyone else has reached their daily limit or is busy at that time.`
      )
    )
  }

  if (processed.length === 0) {
    throw conflict(
      'No seats have been allocated for the selected paper(s) yet. Allocate seats first, or choose rooms explicitly.',
      'NO_SEAT_ALLOCATION'
    )
  }

  await prisma.$transaction([
    prisma.invigilationDuty.deleteMany({ where: { organizationId, sessionId: { in: processed } } }),
    prisma.invigilationDuty.createMany({ data: planned }),
  ])

  await audit(ctx, {
    action: 'duties.auto-allocated',
    entityType: 'exam',
    entityId: exam.id,
    summary: `Auto-assigned ${planned.length} invigilation duties for “${exam.name}” across ${processed.length} paper${processed.length === 1 ? '' : 's'} (${input.strategy.replace(/_/g, ' ')})`,
    metadata: { strategy: input.strategy, duties: planned.length, papers: processed.length, warnings: warnings.length },
  })
  return { created: planned.length, sessions: processed.length, warnings }
}

export async function assignDuty(ctx: AuthContext, input: AssignDutyInput): Promise<RoomTeacherDuty> {
  const { organizationId } = ctx
  await syncExamStatuses(organizationId)
  const session = await findSession(ctx, input.sessionId)
  assertEditable(session.exam.status)
  const [room, teacher] = await Promise.all([
    prisma.room.findFirst({ where: { id: input.roomId, organizationId }, select: { id: true, name: true } }),
    prisma.teacher.findFirst({
      where: { id: input.teacherId, organizationId },
      select: { id: true, maxDuties: true, user: { select: { firstName: true, lastName: true } } },
    }),
  ])
  if (!room) throw notFound('Room not found')
  if (!teacher) throw notFound('Teacher not found')

  const name = fullName(teacher.user)
  const slot = slotOf(session)
  const sameDay = await prisma.invigilationDuty.findMany({
    where: { organizationId, teacherId: teacher.id, session: { examDate: session.examDate } },
    select: {
      sessionId: true,
      roomId: true,
      room: { select: { name: true } },
      session: { select: { subjectName: true, examDate: true, startTime: true, endTime: true } },
    },
  })
  const isThisDuty = (d: { sessionId: string; roomId: string }) => d.sessionId === session.id && d.roomId === room.id
  const clash = sameDay.find((d) => !isThisDuty(d) && slotsOverlap(slot, slotOf(d.session)))
  if (clash) {
    throw conflict(
      `${name} is already invigilating “${clash.session.subjectName}” in ${clash.room.name} at an overlapping time.`,
      'DUTY_CONFLICT'
    )
  }
  const dayCount = sameDay.filter((d) => !isThisDuty(d)).length
  const limit = teacher.maxDuties || 2
  if (!input.override && dayCount >= limit) {
    throw conflict(
      `${name} already has ${dayCount} dut${dayCount === 1 ? 'y' : 'ies'} on ${slot.examDate} (daily limit ${limit}).`,
      'DUTY_LIMIT'
    )
  }

  const role = DUTY_ROLE_FROM_LABEL[input.role]
  const duty = await prisma.invigilationDuty.upsert({
    where: { sessionId_roomId_teacherId: { sessionId: session.id, roomId: room.id, teacherId: teacher.id } },
    create: { organizationId, examId: session.examId, sessionId: session.id, roomId: room.id, teacherId: teacher.id, role, notes: input.notes },
    update: { role, notes: input.notes },
    include: dutyInclude,
  })

  await audit(ctx, {
    action: 'duty.assigned',
    entityType: 'exam',
    entityId: session.examId,
    summary: `Assigned ${name} as ${input.role} in ${room.name} for “${session.subjectName}”${input.override && dayCount >= limit ? ' (over daily limit)' : ''}`,
  })
  const counts = await seatedCounts(organizationId, session.id)
  return toDutyDto(duty, counts.get(room.id))
}

export async function removeDuty(ctx: AuthContext, dutyId: string): Promise<void> {
  const duty = await prisma.invigilationDuty.findFirst({
    where: { id: dutyId, organizationId: ctx.organizationId },
    select: {
      examId: true,
      exam: { select: { status: true } },
      room: { select: { name: true } },
      session: { select: { subjectName: true } },
      teacher: { select: { user: { select: { firstName: true, lastName: true } } } },
    },
  })
  if (!duty) throw notFound('Duty not found')
  assertEditable(duty.exam.status)
  await prisma.invigilationDuty.delete({ where: { id: dutyId } })
  await audit(ctx, {
    action: 'duty.removed',
    entityType: 'exam',
    entityId: duty.examId,
    summary: `Removed ${fullName(duty.teacher.user)} from ${duty.room.name} for “${duty.session.subjectName}”`,
  })
}

/** Clears duties for one paper, or every paper of the exam. */
export async function clearDuties(ctx: AuthContext, examId: string, sessionId?: string): Promise<number> {
  const exam = await prisma.exam.findFirst({ where: { id: examId, organizationId: ctx.organizationId }, select: { name: true, status: true } })
  if (!exam) throw notFound('Exam not found')
  assertEditable(exam.status)
  const { count } = await prisma.invigilationDuty.deleteMany({ where: { organizationId: ctx.organizationId, examId, sessionId } })
  await audit(ctx, {
    action: 'duties.cleared',
    entityType: 'exam',
    entityId: examId,
    summary: `Cleared ${count} invigilation duties for “${exam.name}”`,
  })
  return count
}

/**
 * A teacher's duties (per paper) with co-invigilators and attendance progress.
 * Teachers always get their own record; admins may preview any teacher.
 */
export async function getMyDuties(ctx: AuthContext, teacherId?: string, examId?: string): Promise<MyDutiesResponse> {
  const { organizationId } = ctx
  await syncExamStatuses(organizationId)
  const admin = isAdminRole(ctx.role)
  const teacher = await prisma.teacher.findFirst({
    where: { organizationId, ...(admin ? { id: teacherId } : { userId: ctx.userId }) },
    include: teacherInclude,
    orderBy: { employeeId: 'asc' },
  })
  if (!teacher) throw notFound(admin ? 'Teacher not found' : 'No teacher profile is linked to this account')

  const duties = await prisma.invigilationDuty.findMany({
    where: { organizationId, teacherId: teacher.id, examId, exam: admin ? undefined : { status: { not: 'DRAFT' } } },
    include: { ...dutyInclude, exam: { select: { name: true, status: true } } },
    orderBy: [{ session: { examDate: 'asc' } }, { session: { startTime: 'asc' } }, ...dutyOrder],
  })

  const slots = duties.map((d) => ({ sessionId: d.sessionId, roomId: d.roomId }))
  const peers = slots.length
    ? await prisma.invigilationDuty.findMany({
        where: { organizationId, OR: slots, teacherId: { not: teacher.id } },
        select: {
          id: true,
          sessionId: true,
          roomId: true,
          teacherId: true,
          role: true,
          teacher: { select: { employeeId: true, user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { role: 'asc' },
      })
    : []
  const seatGroups = slots.length
    ? await prisma.seatAllocation.groupBy({
        by: ['sessionId', 'roomId', 'attendanceStatus'],
        where: { organizationId, OR: slots },
        _count: { _all: true },
      })
    : []

  const key = (sessionId: string, roomId: string) => `${sessionId}:${roomId}`
  const attendance = new Map<string, AttendanceCounts>()
  seatGroups.forEach((g) => {
    const counts = attendance.get(key(g.sessionId, g.roomId)) ?? { total: 0, present: 0, absent: 0, pending: 0 }
    counts.total += g._count._all
    if (g.attendanceStatus === 'PRESENT') counts.present += g._count._all
    else if (g.attendanceStatus === 'ABSENT') counts.absent += g._count._all
    else counts.pending += g._count._all
    attendance.set(key(g.sessionId, g.roomId), counts)
  })
  const today = await organizationToday(organizationId)

  return {
    teacher: toTeacherDto(teacher),
    duties: duties.map((d) => {
      const counts = attendance.get(key(d.sessionId, d.roomId)) ?? { total: 0, present: 0, absent: 0, pending: 0 }
      return {
        ...toDutyDto(d, counts.total || undefined),
        attendance: counts,
        attendanceOpen: d.exam.status !== 'CANCELLED' && toDateOnly(d.session.examDate) <= today,
        coInvigilators: peers
          .filter((p) => p.sessionId === d.sessionId && p.roomId === d.roomId)
          .map((p) => ({
            id: p.id,
            teacherId: p.teacherId,
            teacherName: fullName(p.teacher.user),
            employeeId: p.teacher.employeeId,
            role: DUTY_ROLE_LABEL[p.role],
          })),
      }
    }),
  }
}
