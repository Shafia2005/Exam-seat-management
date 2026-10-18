// Prisma row → API DTO conversion. DTOs match the client types in `src/types`,
// so the UI keeps consuming the same shapes it used with the mock services:
// lower-case enum values, `YYYY-MM-DD` dates and flattened user names.

import type { DutyRole, Prisma } from '@prisma/client'
import type { Organization, User } from '@/types/auth.types'
import type { AdminUser, AuditLogEntry, NotificationLogEntry } from '@/types/admin.types'
import type { Course, Department } from '@/types/catalog.types'
import type { Exam, ExamSubject } from '@/types/exam.types'
import type { Allocation, Bench, Block, Room } from '@/types/seat.types'
import type { Student } from '@/types/student.types'
import type { Teacher } from '@/types/teacher.types'
import type { InvigilationRole, RoomTeacherDuty } from '@/types/teacherDuty.types'
import { ROLE_DISPLAY_NAME, permissionsFor, toClientRole } from '@/lib/auth/roles'
import { slotLabel } from './scheduling/time'

// ─── Primitive helpers ──────────────────────────────────────────────────────

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function toDateOnlyOrUndefined(date: Date | null): string | undefined {
  return date ? toDateOnly(date) : undefined
}

/** Parses `YYYY-MM-DD` as a UTC date, matching how Postgres `DATE` columns round-trip. */
export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

/** Keeps `undefined` (field untouched) and `null` (field cleared) for Prisma writes. */
export function parseOptionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined || value === null) return value
  return parseDateOnly(value)
}

const lower = <T extends string>(value: T) => value.toLowerCase() as Lowercase<T>

export const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`

export const DUTY_ROLE_LABEL: Record<DutyRole, InvigilationRole> = {
  CHIEF_INVIGILATOR: 'Chief Invigilator',
  INVIGILATOR: 'Invigilator',
  RELIEVER: 'Reliever',
}

export const DUTY_ROLE_FROM_LABEL: Record<InvigilationRole, DutyRole> = {
  'Chief Invigilator': 'CHIEF_INVIGILATOR',
  Invigilator: 'INVIGILATOR',
  Reliever: 'RELIEVER',
}

// ─── Organization & users ───────────────────────────────────────────────────

export function toOrganizationDto(o: Prisma.OrganizationGetPayload<object>): Organization {
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    code: o.code,
    domain: o.domain ?? undefined,
    logoUrl: o.logoUrl ?? undefined,
    address: o.address ?? undefined,
    isActive: o.isActive,
    minAttendancePercent: o.minAttendancePercent,
    timezone: o.timezone,
  }
}

export const userProfileInclude = {
  organization: true,
  teacher: { select: { id: true, employeeId: true, designation: true, department: { select: { name: true } } } },
  student: {
    select: {
      id: true,
      rollNumber: true,
      currentSemester: true,
      department: { select: { name: true } },
      course: { select: { name: true } },
    },
  },
} satisfies Prisma.UserInclude

export type UserWithProfile = Prisma.UserGetPayload<{ include: typeof userProfileInclude }>

export function toUserDto(u: UserWithProfile): User {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    isActive: u.isActive,
    emailVerified: false,
    lastLogin: u.lastLoginAt?.toISOString(),
    role: u.role,
    organizationId: u.organizationId,
    roles: [
      {
        id: u.role,
        name: toClientRole(u.role),
        displayName: ROLE_DISPLAY_NAME[u.role],
        permissions: permissionsFor(u.role),
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
      },
    ],
    teacherId: u.teacher?.id,
    employeeId: u.teacher?.employeeId,
    designation: u.teacher?.designation,
    studentId: u.student?.id,
    rollNumber: u.student?.rollNumber,
    courseName: u.student?.course.name,
    currentSemester: u.student?.currentSemester,
    departmentName: u.teacher?.department.name ?? u.student?.department.name,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }
}

// ─── Catalog ────────────────────────────────────────────────────────────────

export const departmentInclude = {
  _count: { select: { students: true, teachers: true, courses: true } },
} satisfies Prisma.DepartmentInclude

export function toDepartmentDto(d: Prisma.DepartmentGetPayload<{ include: typeof departmentInclude }>): Department {
  return {
    id: d.id,
    name: d.name,
    code: d.code,
    description: d.description ?? undefined,
    studentCount: d._count.students,
    teacherCount: d._count.teachers,
    courseCount: d._count.courses,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }
}

export const courseInclude = {
  department: { select: { name: true } },
  _count: { select: { students: true } },
} satisfies Prisma.CourseInclude

export function toCourseDto(c: Prisma.CourseGetPayload<{ include: typeof courseInclude }>): Course {
  return {
    id: c.id,
    name: c.name,
    code: c.code,
    departmentId: c.departmentId,
    departmentName: c.department.name,
    durationYears: c.durationYears,
    studentCount: c._count.students,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

// ─── Students & teachers ────────────────────────────────────────────────────

export const studentInclude = {
  user: { select: { email: true, firstName: true, lastName: true } },
  department: { select: { name: true } },
  course: { select: { name: true } },
} satisfies Prisma.StudentInclude

export type StudentRow = Prisma.StudentGetPayload<{ include: typeof studentInclude }>

export function toStudentDto(s: StudentRow): Student {
  return {
    id: s.id,
    rollNumber: s.rollNumber,
    registrationNumber: s.registrationNumber ?? undefined,
    firstName: s.user.firstName,
    lastName: s.user.lastName,
    email: s.user.email,
    phone: s.phone ?? undefined,
    gender: lower(s.gender),
    dateOfBirth: toDateOnlyOrUndefined(s.dateOfBirth),
    bloodGroup: s.bloodGroup ?? undefined,
    departmentId: s.departmentId,
    departmentName: s.department.name,
    courseId: s.courseId,
    courseName: s.course.name,
    currentSemester: s.currentSemester,
    section: s.section ?? undefined,
    batchYear: s.batchYear,
    admissionDate: toDateOnlyOrUndefined(s.admissionDate),
    address: s.address ?? undefined,
    emergencyContactName: s.emergencyContactName ?? undefined,
    emergencyContactPhone: s.emergencyContactPhone ?? undefined,
    attendancePercentage: s.attendancePercentage,
    isEligible: s.isEligible,
    eligibilityOverride: s.eligibilityOverride,
    status: lower(s.status),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }
}

export const teacherInclude = {
  user: { select: { email: true, firstName: true, lastName: true } },
  department: { select: { name: true } },
} satisfies Prisma.TeacherInclude

export type TeacherRow = Prisma.TeacherGetPayload<{ include: typeof teacherInclude }>

export function toTeacherDto(t: TeacherRow): Teacher {
  return {
    id: t.id,
    employeeId: t.employeeId,
    firstName: t.user.firstName,
    lastName: t.user.lastName,
    email: t.user.email,
    phone: t.phone ?? undefined,
    departmentId: t.departmentId,
    departmentName: t.department.name,
    designation: t.designation,
    specialization: t.specialization ?? undefined,
    qualification: t.qualification ?? undefined,
    experienceYears: t.experienceYears,
    joiningDate: toDateOnlyOrUndefined(t.joiningDate),
    isAvailable: t.isAvailable,
    maxDutiesPerDay: t.maxDuties,
    status: lower(t.status),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}

// ─── Exams ──────────────────────────────────────────────────────────────────

export const examInclude = {
  sessions: { orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }] },
} satisfies Prisma.ExamInclude

export function toExamSubjectDto(s: Prisma.ExamSessionGetPayload<object>): ExamSubject {
  return {
    id: s.id,
    examId: s.examId,
    subjectId: s.subjectCode ?? s.id,
    subjectName: s.subjectName,
    examDate: toDateOnly(s.examDate),
    startTime: s.startTime,
    endTime: s.endTime,
    durationMinutes: s.durationMinutes,
    maximumMarks: s.maximumMarks,
    passingMarks: s.passingMarks,
  }
}

export function toExamDto(e: Prisma.ExamGetPayload<{ include: typeof examInclude }>): Exam {
  return {
    id: e.id,
    name: e.name,
    examType: lower(e.examType),
    academicYear: e.academicYear,
    semester: e.semester,
    startDate: toDateOnly(e.startDate),
    endDate: toDateOnly(e.endDate),
    description: e.description ?? undefined,
    instructions: e.instructions ?? undefined,
    status: lower(e.status),
    createdBy: e.createdById ?? '',
    subjects: e.sessions.map(toExamSubjectDto),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }
}

// ─── Infrastructure ─────────────────────────────────────────────────────────

export const blockInclude = { _count: { select: { rooms: true } } } satisfies Prisma.BlockInclude

export function toBlockDto(b: Prisma.BlockGetPayload<{ include: typeof blockInclude }>): Block {
  return {
    id: b.id,
    name: b.name,
    code: b.code,
    capacity: b.capacity,
    floor: b.floor ?? 0,
    buildingName: b.buildingName ?? '',
    isActive: b.isActive,
    roomCount: b._count.rooms,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }
}

export const roomInclude = {
  block: { select: { name: true } },
  _count: { select: { benches: true } },
} satisfies Prisma.RoomInclude

export function toRoomDto(r: Prisma.RoomGetPayload<{ include: typeof roomInclude }>): Room {
  return {
    id: r.id,
    name: r.name,
    number: r.number,
    blockId: r.blockId,
    blockName: r.block.name,
    capacity: r.capacity,
    rows: r.rows,
    columns: r.columns,
    isAvailable: r.isAvailable,
    floor: r.floor ?? undefined,
    benchCount: r._count.benches,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

export const benchInclude = { room: { select: { number: true } } } satisfies Prisma.BenchInclude

export function toBenchDto(b: Prisma.BenchGetPayload<{ include: typeof benchInclude }>): Bench {
  return {
    id: b.id,
    number: b.number,
    roomId: b.roomId,
    roomNumber: b.room.number,
    row: b.row,
    column: b.column,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }
}

// ─── Seat allocations & duties ──────────────────────────────────────────────

export const allocationInclude = {
  student: {
    select: {
      rollNumber: true,
      departmentId: true,
      user: { select: { firstName: true, lastName: true } },
      department: { select: { name: true } },
    },
  },
  bench: { select: { number: true, row: true, column: true } },
  room: { select: { name: true, blockId: true, block: { select: { name: true } } } },
} satisfies Prisma.SeatAllocationInclude

export function toAllocationDto(a: Prisma.SeatAllocationGetPayload<{ include: typeof allocationInclude }>): Allocation {
  return {
    id: a.id,
    sessionId: a.sessionId,
    studentId: a.studentId,
    studentName: fullName(a.student.user),
    studentRollNumber: a.student.rollNumber,
    departmentId: a.student.departmentId,
    departmentName: a.student.department.name,
    benchId: a.benchId,
    benchNumber: a.bench.number,
    roomId: a.roomId,
    roomNumber: a.room.name,
    row: a.bench.row,
    column: a.bench.column,
    blockId: a.room.blockId,
    blockName: a.room.block.name,
    seatPosition: a.seatPosition,
    seatLabel: a.seatLabel,
    attendanceStatus: a.attendanceStatus ? lower(a.attendanceStatus) : null,
  }
}

export const dutyInclude = {
  exam: { select: { name: true } },
  session: { select: { subjectName: true, examDate: true, startTime: true, endTime: true } },
  room: { select: { name: true, capacity: true, blockId: true, block: { select: { name: true } } } },
  teacher: {
    select: {
      employeeId: true,
      designation: true,
      maxDuties: true,
      user: { select: { firstName: true, lastName: true } },
      department: { select: { name: true } },
    },
  },
} satisfies Prisma.InvigilationDutyInclude

export type DutyRow = Prisma.InvigilationDutyGetPayload<{ include: typeof dutyInclude }>

/** `studentCount` is the number of students seated in the room; defaults to room capacity. */
export function toDutyDto(d: DutyRow, studentCount?: number): RoomTeacherDuty {
  return {
    id: d.id,
    examId: d.examId,
    examName: d.exam.name,
    sessionId: d.sessionId,
    subjectName: d.session.subjectName,
    startTime: d.session.startTime,
    endTime: d.session.endTime,
    roomId: d.roomId,
    roomNumber: d.room.name,
    blockId: d.room.blockId,
    blockName: d.room.block.name,
    teacherId: d.teacherId,
    teacherName: fullName(d.teacher.user),
    employeeId: d.teacher.employeeId,
    teacherDepartment: d.teacher.department.name,
    designation: d.teacher.designation,
    role: DUTY_ROLE_LABEL[d.role],
    sessionDate: toDateOnly(d.session.examDate),
    sessionSlot: slotLabel(d.session.startTime, d.session.endTime),
    studentCount: studentCount ?? d.room.capacity,
    maxDutiesPerDay: d.teacher.maxDuties,
    status: lower(d.status),
    notes: d.notes ?? undefined,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }
}

// ─── Administrators, audit log & notifications ──────────────────────────────

export const adminSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect

export function toAdminDto(u: Prisma.UserGetPayload<{ select: typeof adminSelect }>): AdminUser {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    role: u.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN',
    isActive: u.isActive,
    lastLogin: u.lastLoginAt?.toISOString(),
    createdAt: u.createdAt.toISOString(),
  }
}

export function toAuditDto(a: Prisma.AuditLogGetPayload<object>): AuditLogEntry {
  return {
    id: a.id,
    actorId: a.actorId ?? undefined,
    actorName: a.actorName,
    action: a.action,
    entityType: a.entityType,
    entityId: a.entityId ?? undefined,
    summary: a.summary,
    metadata: (a.metadata as Record<string, unknown> | null) ?? undefined,
    createdAt: a.createdAt.toISOString(),
  }
}

export function toNotificationDto(n: Prisma.NotificationLogGetPayload<object>): NotificationLogEntry {
  return {
    id: n.id,
    channel: lower(n.channel),
    recipient: n.recipient,
    recipientName: n.recipientName ?? undefined,
    subject: n.subject ?? undefined,
    body: n.body,
    status: lower(n.status),
    error: n.error ?? undefined,
    relatedType: n.relatedType ?? undefined,
    createdAt: n.createdAt.toISOString(),
  }
}
