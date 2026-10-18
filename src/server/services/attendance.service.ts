import type { ExamAttendanceStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isAdminRole } from '@/lib/auth/roles'
import type { AttendanceSummaryRow, HallAttendance } from '@/types/admin.types'
import type { AttendanceCounts } from '@/types/teacherDuty.types'
import { audit } from '../audit'
import { conflict, forbidden, notFound } from '../http'
import { DUTY_ROLE_LABEL, fullName, toDateOnly } from '../mappers'
import type { AuthContext } from '../session'
import type { MarkAttendanceInput } from '../validation'
import { organizationToday, syncExamStatuses } from './exams.service'

const emptyCounts = (): AttendanceCounts => ({ total: 0, present: 0, absent: 0, pending: 0 })

/** Admins may take attendance anywhere; teachers only in halls where they invigilate that paper. */
async function loadHall(ctx: AuthContext, sessionId: string, roomId: string) {
  const [session, room] = await Promise.all([
    prisma.examSession.findFirst({
      where: { id: sessionId, organizationId: ctx.organizationId },
      select: { id: true, examId: true, subjectName: true, examDate: true, startTime: true, endTime: true, exam: { select: { name: true, status: true } } },
    }),
    prisma.room.findFirst({
      where: { id: roomId, organizationId: ctx.organizationId },
      select: { id: true, name: true, block: { select: { name: true } } },
    }),
  ])
  if (!session) throw notFound('Paper not found')
  if (!room) throw notFound('Room not found')

  const duties = await prisma.invigilationDuty.findMany({
    where: { sessionId, roomId },
    select: { role: true, teacher: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } } },
    orderBy: { role: 'asc' },
  })
  const assigned = duties.some((d) => d.teacher.userId === ctx.userId)
  if (!isAdminRole(ctx.role) && !assigned) {
    throw forbidden('You can only take attendance in halls where you are invigilating this paper.')
  }

  const today = await organizationToday(ctx.organizationId)
  const open = session.exam.status !== 'CANCELLED' && toDateOnly(session.examDate) <= today
  return { session, room, duties, open }
}

export async function getHallAttendance(ctx: AuthContext, sessionId: string, roomId: string): Promise<HallAttendance> {
  await syncExamStatuses(ctx.organizationId)
  const { session, room, duties, open } = await loadHall(ctx, sessionId, roomId)
  const seats = await prisma.seatAllocation.findMany({
    where: { organizationId: ctx.organizationId, sessionId, roomId },
    select: {
      id: true,
      studentId: true,
      seatLabel: true,
      attendanceStatus: true,
      attendanceMarkedAt: true,
      bench: { select: { number: true, row: true, column: true } },
      student: {
        select: { rollNumber: true, user: { select: { firstName: true, lastName: true } }, department: { select: { name: true } } },
      },
    },
    orderBy: [{ bench: { row: 'asc' } }, { bench: { column: 'asc' } }, { seatPosition: 'asc' }],
  })

  const summary = emptyCounts()
  seats.forEach((s) => {
    summary.total++
    if (s.attendanceStatus === 'PRESENT') summary.present++
    else if (s.attendanceStatus === 'ABSENT') summary.absent++
    else summary.pending++
  })

  return {
    examId: session.examId,
    examName: session.exam.name,
    sessionId: session.id,
    subjectName: session.subjectName,
    examDate: toDateOnly(session.examDate),
    startTime: session.startTime,
    endTime: session.endTime,
    roomId: room.id,
    roomName: room.name,
    blockName: room.block.name,
    open,
    canMark: open,
    invigilators: duties.map((d) => ({ teacherName: fullName(d.teacher.user), role: DUTY_ROLE_LABEL[d.role] })),
    summary,
    seats: seats.map((s) => ({
      allocationId: s.id,
      studentId: s.studentId,
      rollNumber: s.student.rollNumber,
      studentName: fullName(s.student.user),
      departmentName: s.student.department.name,
      seatLabel: s.seatLabel,
      benchNumber: s.bench.number,
      row: s.bench.row,
      column: s.bench.column,
      status: s.attendanceStatus ? (s.attendanceStatus.toLowerCase() as 'present' | 'absent') : null,
      markedAt: s.attendanceMarkedAt?.toISOString(),
    })),
  }
}

export async function markAttendance(ctx: AuthContext, input: MarkAttendanceInput): Promise<HallAttendance> {
  await syncExamStatuses(ctx.organizationId)
  const { session, room, open } = await loadHall(ctx, input.sessionId, input.roomId)
  if (!open) {
    throw conflict(
      session.exam.status === 'CANCELLED'
        ? 'This exam was cancelled, so attendance cannot be recorded.'
        : `Attendance opens on the day of the paper (${toDateOnly(session.examDate)}).`,
      'ATTENDANCE_CLOSED'
    )
  }

  const groups = new Map<ExamAttendanceStatus | null, string[]>()
  input.marks.forEach((m) => {
    const status = m.status ? (m.status.toUpperCase() as ExamAttendanceStatus) : null
    groups.set(status, [...(groups.get(status) ?? []), m.allocationId])
  })

  const now = new Date()
  const updates = Array.from(groups.entries()).map(([status, ids]) =>
    prisma.seatAllocation.updateMany({
      // Scoped to this paper and hall so IDs from elsewhere are ignored.
      where: { id: { in: ids }, organizationId: ctx.organizationId, sessionId: session.id, roomId: room.id },
      data: {
        attendanceStatus: status,
        attendanceMarkedAt: status ? now : null,
        attendanceMarkedById: status ? ctx.userId : null,
      },
    })
  )
  const results = await prisma.$transaction(updates)
  const changed = results.reduce((sum, r) => sum + r.count, 0)

  const hall = await getHallAttendance(ctx, session.id, room.id)
  await audit(ctx, {
    action: 'attendance.marked',
    entityType: 'exam',
    entityId: session.examId,
    summary: `Recorded attendance for ${changed} seat${changed === 1 ? '' : 's'} in ${room.name} for “${session.subjectName}” (${hall.summary.present} present, ${hall.summary.absent} absent)`,
  })
  return hall
}

/** Attendance per paper and hall for one exam (admins). */
export async function getAttendanceSummary(ctx: AuthContext, examId: string): Promise<AttendanceSummaryRow[]> {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, organizationId: ctx.organizationId },
    include: { sessions: { orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }] } },
  })
  if (!exam) throw notFound('Exam not found')

  const [groups, rooms] = await Promise.all([
    prisma.seatAllocation.groupBy({
      by: ['sessionId', 'roomId', 'attendanceStatus'],
      where: { organizationId: ctx.organizationId, examId },
      _count: { _all: true },
    }),
    prisma.room.findMany({ where: { organizationId: ctx.organizationId }, select: { id: true, name: true } }),
  ])
  const roomName = new Map(rooms.map((r) => [r.id, r.name]))

  return exam.sessions.map((session) => {
    const perRoom = new Map<string, AttendanceCounts>()
    const totals = emptyCounts()
    groups
      .filter((g) => g.sessionId === session.id)
      .forEach((g) => {
        const counts = perRoom.get(g.roomId) ?? emptyCounts()
        const n = g._count._all
        counts.total += n
        totals.total += n
        if (g.attendanceStatus === 'PRESENT') {
          counts.present += n
          totals.present += n
        } else if (g.attendanceStatus === 'ABSENT') {
          counts.absent += n
          totals.absent += n
        } else {
          counts.pending += n
          totals.pending += n
        }
        perRoom.set(g.roomId, counts)
      })
    return {
      sessionId: session.id,
      subjectName: session.subjectName,
      examDate: toDateOnly(session.examDate),
      startTime: session.startTime,
      endTime: session.endTime,
      totals,
      rooms: Array.from(perRoom.entries())
        .map(([roomId, counts]) => ({ roomId, roomName: roomName.get(roomId) ?? roomId, ...counts }))
        .sort((a, b) => a.roomName.localeCompare(b.roomName, undefined, { numeric: true })),
    }
  })
}
