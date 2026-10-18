// Seeds the default organization from the mock JSON in `src/services/mock/data`.
// Re-running rebuilds that organization only (other tenants are untouched).
//
//   npm run db:seed

import { readFileSync } from 'fs'
import path from 'path'
import {
  PrismaClient,
  type ExamStatus,
  type ExamType,
  type Gender,
  type StudentStatus,
  type TeacherStatus,
} from '@prisma/client'
import { hash } from 'bcryptjs'
import { assignSeats, seatLabel, type SeatSlot } from '../src/server/allocation/seat-algorithms'
import { todayInTimeZone } from '../src/server/scheduling/time'

const prisma = new PrismaClient()

const DATA_DIR = path.join(__dirname, '..', 'src', 'services', 'mock', 'data')

const ORGANIZATION = {
  name: 'Apex Institute of Technology',
  slug: 'apex-institute',
  code: 'APEX',
  address: 'Tech Park Boulevard, Silicon City',
}

const DEMO_ACCOUNTS = {
  admin: { email: 'admin@example.com', password: 'admin123' },
  teacher: { email: 'teacher@example.com', password: 'teacher123' },
  student: { email: 'student@example.com', password: 'student123' },
}

// Rooms (mock IDs) that receive the demo seat allocation for every paper.
const DEMO_ALLOCATION_ROOMS = ['1', '2']

// Demo invigilation roster used for every paper: [mock room id, employee ID, role].
const DEMO_DUTIES: [string, string, 'CHIEF_INVIGILATOR' | 'INVIGILATOR'][] = [
  ['1', 'TCH003', 'CHIEF_INVIGILATOR'],
  ['1', 'TCH002', 'INVIGILATOR'],
  ['2', 'TCH010', 'CHIEF_INVIGILATOR'],
  ['2', 'TCH008', 'INVIGILATOR'],
]

// ─── Mock JSON shapes ───────────────────────────────────────────────────────

interface MockStudent {
  id: string
  rollNumber: string
  registrationNumber?: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  gender: string
  dateOfBirth?: string
  bloodGroup?: string
  departmentId: string
  departmentName: string
  courseId: string
  courseName: string
  currentSemester: number
  section?: string
  batchYear: number
  admissionDate?: string
  address?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  attendancePercentage: number
  isEligible: boolean
  eligibilityOverride: boolean
  status: string
}

interface MockTeacher {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  departmentId: string
  departmentName: string
  designation: string
  specialization?: string
  qualification?: string
  experienceYears: number
  joiningDate?: string
  isAvailable: boolean
  maxDutiesPerDay: number
  status: string
}

interface MockBlock {
  id: string
  name: string
  code: string
  capacity: number
  floor: number
  buildingName: string
  isActive: boolean
}

interface MockRoom {
  id: string
  name: string
  number: string
  blockId: string
  capacity: number
  rows: number
  columns: number
  isAvailable: boolean
}

interface MockBench {
  id: string
  number: string
  roomId: string
  row: number
  column: number
}

interface MockExam {
  id: string
  name: string
  examType: string
  academicYear: string
  semester: number
  startDate: string
  endDate: string
  description?: string
  instructions?: string
  status: string
  subjects: {
    subjectId: string
    subjectName?: string
    examDate: string
    startTime: string
    endTime: string
    durationMinutes: number
    maximumMarks: number
    passingMarks: number
  }[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function load<T>(file: string): T[] {
  return JSON.parse(readFileSync(path.join(DATA_DIR, file), 'utf8')) as T[]
}

const toDate = (value?: string) => (value ? new Date(`${value}T00:00:00.000Z`) : null)
const upper = <T extends string>(value: string) => value.toUpperCase() as T

// The mock exam calendar is written around this day: one exam is finished and
// the other is under way with a paper on this date. Exam dates are shifted so
// that this day lands on "today", keeping the demo live whenever it is seeded.
// Set SEED_KEEP_DATES=true to keep the dates exactly as in exams.json.
const MOCK_CALENDAR_TODAY = '2026-10-18'
const DAY_MS = 24 * 60 * 60 * 1000

function examDateShifter(today: string): (value: string) => Date {
  const offset = process.env.SEED_KEEP_DATES === 'true' ? 0 : (toDate(today)!.getTime() - toDate(MOCK_CALENDAR_TODAY)!.getTime()) / DAY_MS
  return (value) => new Date(toDate(value)!.getTime() + offset * DAY_MS)
}

function lookup<K, V>(map: Map<K, V>, key: K, what: string): V {
  const value = map.get(key)
  if (value === undefined) throw new Error(`Seed data references unknown ${what} "${String(key)}"`)
  return value
}

// ─── Seed ───────────────────────────────────────────────────────────────────

async function main() {
  const students = load<MockStudent>('students.json')
  const teachers = load<MockTeacher>('teachers.json')
  const blocks = load<MockBlock>('blocks.json')
  const rooms = load<MockRoom>('rooms.json')
  const benches = load<MockBench>('benches.json')
  const exams = load<MockExam>('exams.json')

  const removed = await prisma.organization.deleteMany({
    where: { OR: [{ slug: ORGANIZATION.slug }, { code: ORGANIZATION.code }] },
  })
  if (removed.count) console.log(`↺ Removed existing "${ORGANIZATION.slug}" organization`)

  const org = await prisma.organization.create({ data: ORGANIZATION })
  const organizationId = org.id
  console.log(`✓ Organization: ${org.name} (slug "${org.slug}", code "${org.code}")`)

  // Seed accounts share one hash per role so seeding stays fast (bcrypt is deliberately slow).
  const [adminHash, teacherHash, studentHash] = await Promise.all([
    hash(DEMO_ACCOUNTS.admin.password, 12),
    hash(DEMO_ACCOUNTS.teacher.password, 12),
    hash(DEMO_ACCOUNTS.student.password, 12),
  ])

  const admin = await prisma.user.create({
    data: {
      organizationId,
      email: DEMO_ACCOUNTS.admin.email,
      passwordHash: adminHash,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'SUPER_ADMIN',
    },
  })

  // ── Departments & courses (codes come from the roll-number prefix, e.g. "CS2024001") ──
  const deptCodeByMockId = new Map<string, string>()
  const deptNameByMockId = new Map<string, string>()
  students.forEach((s) => {
    deptNameByMockId.set(s.departmentId, s.departmentName)
    const prefix = s.rollNumber.match(/^[A-Z]+/)?.[0]
    if (prefix && !deptCodeByMockId.has(s.departmentId)) deptCodeByMockId.set(s.departmentId, prefix)
  })
  teachers.forEach((t) => {
    if (!deptNameByMockId.has(t.departmentId)) deptNameByMockId.set(t.departmentId, t.departmentName)
  })

  const departmentRows = await prisma.department.createManyAndReturn({
    data: Array.from(deptNameByMockId.entries()).map(([mockId, name]) => ({
      organizationId,
      name,
      code: deptCodeByMockId.get(mockId) ?? `DEPT${mockId}`,
    })),
    select: { id: true, code: true },
  })
  const deptIdByCode = new Map(departmentRows.map((d) => [d.code, d.id]))
  const deptId = (mockId: string) =>
    lookup(deptIdByCode, deptCodeByMockId.get(mockId) ?? `DEPT${mockId}`, 'department')

  const courseByMockId = new Map<string, { name: string; departmentMockId: string }>()
  students.forEach((s) => courseByMockId.set(s.courseId, { name: s.courseName, departmentMockId: s.departmentId }))
  const courseRows = await prisma.course.createManyAndReturn({
    data: Array.from(courseByMockId.values()).map((c) => ({
      organizationId,
      departmentId: deptId(c.departmentMockId),
      name: c.name,
      code: `BTECH-${deptCodeByMockId.get(c.departmentMockId)}`,
    })),
    select: { id: true, name: true },
  })
  const courseIdByName = new Map(courseRows.map((c) => [c.name, c.id]))
  console.log(`✓ ${departmentRows.length} departments, ${courseRows.length} courses`)

  // ── Teachers ──
  const teacherUsers = await prisma.user.createManyAndReturn({
    data: teachers.map((t) => ({
      organizationId,
      email: t.email.toLowerCase(),
      passwordHash: teacherHash,
      firstName: t.firstName,
      lastName: t.lastName,
      role: 'TEACHER' as const,
    })),
    select: { id: true, email: true },
  })
  const userIdByEmail = new Map(teacherUsers.map((u) => [u.email, u.id]))
  await prisma.teacher.createMany({
    data: teachers.map((t) => ({
      organizationId,
      userId: lookup(userIdByEmail, t.email.toLowerCase(), 'teacher email'),
      employeeId: t.employeeId,
      departmentId: deptId(t.departmentId),
      designation: t.designation,
      phone: t.phone,
      specialization: t.specialization,
      qualification: t.qualification,
      experienceYears: t.experienceYears,
      joiningDate: toDate(t.joiningDate),
      maxDuties: t.maxDutiesPerDay,
      isAvailable: t.isAvailable,
      status: upper<TeacherStatus>(t.status),
    })),
  })
  const teacherRows = await prisma.teacher.findMany({ where: { organizationId }, select: { id: true, employeeId: true, userId: true } })
  const teacherIdByEmployeeId = new Map(teacherRows.map((t) => [t.employeeId, t.id]))
  const teacherUserIdByEmployeeId = new Map(teacherRows.map((t) => [t.employeeId, t.userId]))
  console.log(`✓ ${teacherRows.length} teachers`)

  // ── Students ──
  const studentUsers = await prisma.user.createManyAndReturn({
    data: students.map((s) => ({
      organizationId,
      email: s.email.toLowerCase(),
      passwordHash: studentHash,
      firstName: s.firstName,
      lastName: s.lastName,
      role: 'STUDENT' as const,
    })),
    select: { id: true, email: true },
  })
  studentUsers.forEach((u) => userIdByEmail.set(u.email, u.id))
  await prisma.student.createMany({
    data: students.map((s) => ({
      organizationId,
      userId: lookup(userIdByEmail, s.email.toLowerCase(), 'student email'),
      rollNumber: s.rollNumber,
      registrationNumber: s.registrationNumber,
      departmentId: deptId(s.departmentId),
      courseId: lookup(courseIdByName, s.courseName, 'course'),
      currentSemester: s.currentSemester,
      section: s.section,
      batchYear: s.batchYear,
      gender: upper<Gender>(s.gender),
      dateOfBirth: toDate(s.dateOfBirth),
      bloodGroup: s.bloodGroup,
      phone: s.phone,
      admissionDate: toDate(s.admissionDate),
      address: s.address,
      emergencyContactName: s.emergencyContactName,
      emergencyContactPhone: s.emergencyContactPhone,
      attendancePercentage: s.attendancePercentage,
      isEligible: s.isEligible,
      eligibilityOverride: s.eligibilityOverride,
      status: upper<StudentStatus>(s.status),
    })),
  })
  const studentRows = await prisma.student.findMany({
    where: { organizationId },
    select: { id: true, rollNumber: true, departmentId: true, isEligible: true, status: true },
  })
  console.log(`✓ ${studentRows.length} students`)

  // ── Blocks, rooms, benches ──
  const blockRows = await prisma.block.createManyAndReturn({
    data: blocks.map((b) => ({
      organizationId,
      name: b.name,
      code: b.code,
      buildingName: b.buildingName,
      floor: b.floor,
      capacity: b.capacity,
      isActive: b.isActive,
    })),
    select: { id: true, code: true },
  })
  const blockIdByCode = new Map(blockRows.map((b) => [b.code, b.id]))
  const blockCodeByMockId = new Map(blocks.map((b) => [b.id, b.code]))

  const roomRows = await prisma.room.createManyAndReturn({
    data: rooms.map((r) => ({
      organizationId,
      blockId: lookup(blockIdByCode, lookup(blockCodeByMockId, r.blockId, 'block'), 'block'),
      name: r.name,
      number: r.number,
      rows: r.rows,
      columns: r.columns,
      capacity: r.capacity,
      isAvailable: r.isAvailable,
    })),
    select: { id: true, name: true },
  })
  const roomIdByName = new Map(roomRows.map((r) => [r.name, r.id]))
  const roomNameByMockId = new Map(rooms.map((r) => [r.id, r.name]))
  const roomId = (mockId: string) => lookup(roomIdByName, lookup(roomNameByMockId, mockId, 'room'), 'room')

  await prisma.bench.createMany({
    data: benches.map((b) => ({
      organizationId,
      roomId: roomId(b.roomId),
      number: b.number,
      row: b.row,
      column: b.column,
    })),
  })
  console.log(`✓ ${blockRows.length} blocks, ${roomRows.length} rooms, ${benches.length} benches`)

  // ── Exams & sessions ──
  // Exam status follows the calendar in the organization's timezone.
  const today = todayInTimeZone(org.timezone)
  const examDate = examDateShifter(today)
  for (const e of exams) {
    await prisma.exam.create({
      data: {
        organizationId,
        name: e.name,
        examType: upper<ExamType>(e.examType),
        academicYear: e.academicYear,
        semester: e.semester,
        startDate: examDate(e.startDate),
        endDate: examDate(e.endDate),
        description: e.description,
        instructions: e.instructions,
        status: upper<ExamStatus>(e.status),
        createdById: admin.id,
        sessions: {
          create: e.subjects.map((s) => ({
            organizationId,
            subjectName: s.subjectName ?? s.subjectId,
            subjectCode: `SUB-${s.subjectId}`,
            examDate: examDate(s.examDate),
            startTime: s.startTime,
            endTime: s.endTime,
            durationMinutes: s.durationMinutes,
            maximumMarks: s.maximumMarks,
            passingMarks: s.passingMarks,
          })),
        },
      },
    })
  }
  const shifted = examDate(MOCK_CALENDAR_TODAY).toISOString().slice(0, 10) !== MOCK_CALENDAR_TODAY
  console.log(`✓ ${exams.length} exams${shifted ? ` (dates shifted so ${MOCK_CALENDAR_TODAY} in the mock calendar is today, ${today})` : ''}`)

  // ── Demo seating for every paper of every exam (anti-cheating algorithm) ──
  const allocationRoomIds = DEMO_ALLOCATION_ROOMS.map(roomId)
  const seatBenches = await prisma.bench.findMany({
    where: { roomId: { in: allocationRoomIds } },
    select: { id: true, row: true, column: true, seatsPerBench: true, roomId: true, room: { select: { name: true } } },
  })
  const seats: SeatSlot[] = seatBenches.map((b) => ({
    benchId: b.id,
    roomId: b.roomId,
    roomName: b.room.name,
    row: b.row,
    column: b.column,
    seatPosition: 1,
    seatsPerBench: b.seatsPerBench,
  }))
  const eligible = studentRows.filter((s) => s.isEligible && s.status === 'ACTIVE')
  const assignments = assignSeats('anti_cheating', eligible, seats)

  const sessions = await prisma.examSession.findMany({
    where: { organizationId },
    select: { id: true, examId: true, examDate: true },
    orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }],
  })

  // Papers before today already have attendance, as the invigilators would have recorded it.
  const chiefByRoom = new Map(
    DEMO_DUTIES.filter(([, , role]) => role === 'CHIEF_INVIGILATOR').map(([mockRoomId, employeeId]) => [
      roomId(mockRoomId),
      lookup(teacherUserIdByEmployeeId, employeeId, 'employee ID'),
    ])
  )
  const attendanceTime = (examDate: Date) => new Date(examDate.getTime() + 4 * 60 * 60 * 1000) // ~09:30 IST
  let marked = 0
  for (const session of sessions) {
    const past = session.examDate.toISOString().slice(0, 10) < today
    await prisma.seatAllocation.createMany({
      data: assignments.map(({ student, seat }, i) => {
        // Deterministic ~4% absences so reports have something to show.
        const absent = past && (i * 7 + session.examDate.getUTCDate()) % 25 === 0
        if (past) marked++
        return {
          organizationId,
          examId: session.examId,
          sessionId: session.id,
          studentId: student.id,
          roomId: seat.roomId,
          benchId: seat.benchId,
          seatPosition: seat.seatPosition,
          seatLabel: seatLabel(seat),
          algorithm: 'ANTI_CHEATING' as const,
          attendanceStatus: past ? (absent ? ('ABSENT' as const) : ('PRESENT' as const)) : null,
          attendanceMarkedAt: past ? attendanceTime(session.examDate) : null,
          attendanceMarkedById: past ? chiefByRoom.get(seat.roomId) ?? admin.id : null,
        }
      }),
    })
  }
  console.log(
    `✓ Seated ${assignments.length} of ${eligible.length} eligible students for each of ${sessions.length} papers (${marked} attendance marks on past papers)`
  )

  // ── Demo invigilation duties for every paper ──
  await prisma.invigilationDuty.createMany({
    data: sessions.flatMap((session) =>
      DEMO_DUTIES.map(([mockRoomId, employeeId, role]) => ({
        organizationId,
        examId: session.examId,
        sessionId: session.id,
        roomId: roomId(mockRoomId),
        teacherId: lookup(teacherIdByEmployeeId, employeeId, 'employee ID'),
        role,
      }))
    ),
  })
  console.log(`✓ ${DEMO_DUTIES.length * sessions.length} invigilation duties`)

  const todayDate = new Date(`${today}T00:00:00.000Z`)
  const published: ExamStatus[] = ['SCHEDULED', 'ONGOING', 'COMPLETED']
  await prisma.exam.updateMany({ where: { organizationId, status: { in: published }, startDate: { gt: todayDate } }, data: { status: 'SCHEDULED' } })
  await prisma.exam.updateMany({
    where: { organizationId, status: { in: published }, startDate: { lte: todayDate }, endDate: { gte: todayDate } },
    data: { status: 'ONGOING' },
  })
  await prisma.exam.updateMany({ where: { organizationId, status: { in: published }, endDate: { lt: todayDate } }, data: { status: 'COMPLETED' } })
  const statuses = await prisma.exam.findMany({ where: { organizationId }, select: { name: true, status: true }, orderBy: { startDate: 'asc' } })
  statuses.forEach((e) => console.log(`  ${e.name}: ${e.status.toLowerCase()} (as of ${today})`))

  await prisma.auditLog.create({
    data: {
      organizationId,
      actorId: admin.id,
      actorName: `${admin.firstName} ${admin.lastName}`,
      action: 'organization.seeded',
      entityType: 'organization',
      entityId: organizationId,
      summary: `Loaded demo data: ${teacherRows.length} teachers, ${studentRows.length} students, ${exams.length} exams`,
    },
  })

  console.log('\nDemo accounts (organization code "%s" or slug "%s"):', ORGANIZATION.code, ORGANIZATION.slug)
  Object.entries(DEMO_ACCOUNTS).forEach(([role, account]) =>
    console.log(`  ${role.padEnd(8)} ${account.email} / ${account.password}`)
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
