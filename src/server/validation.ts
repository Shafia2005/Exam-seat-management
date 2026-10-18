import { z } from 'zod'
import { isValidTimeZone } from './scheduling/time'

// ─── Building blocks ────────────────────────────────────────────────────────

const requiredText = (max = 200) => z.string().trim().min(1, 'Required').max(max)

/** Omitted → `undefined` (leave untouched); empty string or null → `null` (clear). */
const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v || null))

const id = z.string().trim().min(1, 'Required').max(64)

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254)

const password = z.string().min(8, 'Password must be at least 8 characters').max(128)

const dateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD format')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00.000Z`)
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v)
  }, 'Invalid date')

const optionalDate = z
  .union([dateOnly, z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v || null))

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use the HH:mm 24-hour format')

const booleanParam = z.enum(['true', 'false']).transform((v) => v === 'true')

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(10),
})

export const examIdQuery = z.object({ examId: id })
export const optionalExamIdQuery = z.object({ examId: id.optional() })

// ─── Auth ───────────────────────────────────────────────────────────────────

export const loginSchema = z
  .object({
    organization: z.string().trim().max(100).optional(),
    identifier: z.string().trim().max(254).optional(),
    /** Accepted as an alias of `identifier`. */
    email: z.string().trim().max(254).optional(),
    password: z.string().min(1, 'Password is required').max(128),
  })
  .transform(({ email: legacyEmail, identifier, ...rest }) => ({ ...rest, identifier: identifier || legacyEmail || '' }))
  .refine((v) => v.identifier.length > 0, {
    message: 'Enter your email, roll number or employee ID',
    path: ['identifier'],
  })

const RESERVED_SLUGS = ['www', 'api', 'app', 'admin', 'login', 'static', 'assets']

export const registerOrgSchema = z.object({
  organization: z.object({
    name: requiredText(200),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, 'Slug must be at least 3 characters')
      .max(50)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens')
      .refine((v) => !RESERVED_SLUGS.includes(v), 'This slug is reserved'),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(2)
      .max(12)
      .regex(/^[A-Z0-9]+$/, 'Use letters and numbers only')
      .optional(),
    domain: z
      .string()
      .trim()
      .toLowerCase()
      .max(253)
      .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/, 'Enter a domain such as college.edu')
      .optional(),
    address: optionalText(500),
    logoUrl: z.string().trim().url('Enter a valid URL').max(2000).optional(),
  }),
  admin: z.object({
    firstName: requiredText(100),
    lastName: requiredText(100),
    email,
    password,
  }),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(128),
  newPassword: password,
})

/** Admin reset; a temporary password is generated when `password` is omitted. */
export const resetPasswordSchema = z.object({ password: password.optional() })

export const organizationUpdateSchema = z.object({
  name: requiredText(200).optional(),
  address: optionalText(500),
  logoUrl: z
    .union([z.string().trim().url('Enter a valid URL').max(2000), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null)),
  domain: z
    .union([
      z
        .string()
        .trim()
        .toLowerCase()
        .max(253)
        .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/, 'Enter a domain such as college.edu'),
      z.literal(''),
      z.null(),
    ])
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null)),
  minAttendancePercent: z.coerce.number().int().min(0, 'Must be 0–100').max(100, 'Must be 0–100').optional(),
  timezone: z
    .string()
    .trim()
    .refine(isValidTimeZone, 'Choose a valid timezone, e.g. Asia/Kolkata')
    .optional(),
})

// ─── Catalog & infrastructure ───────────────────────────────────────────────

const code = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, 'Required')
  .max(20)
  .regex(/^[A-Z0-9_-]+$/, 'Use letters, numbers, "-" or "_"')

export const departmentCreateSchema = z.object({
  name: requiredText(200),
  code,
  description: optionalText(1000),
})

export const courseCreateSchema = z.object({
  name: requiredText(200),
  code,
  departmentId: id,
  durationYears: z.coerce.number().int().min(1).max(10).optional(),
})

export const departmentUpdateSchema = departmentCreateSchema.partial()

export const courseUpdateSchema = courseCreateSchema.partial()

export const courseListQuery = z.object({ departmentId: id.optional() })

export const blockCreateSchema = z.object({
  name: requiredText(200),
  code,
  buildingName: optionalText(200),
  floor: z.coerce.number().int().min(-5).max(200).optional(),
  capacity: z.coerce.number().int().min(0).optional(),
})

export const blockUpdateSchema = blockCreateSchema.partial().extend({ isActive: z.boolean().optional() })

export const blockListQuery = z.object({ includeInactive: booleanParam.optional() })

export const roomCreateSchema = z.object({
  blockId: id,
  name: requiredText(50),
  number: requiredText(20),
  floor: z.coerce.number().int().min(-5).max(200).optional(),
  rows: z.coerce.number().int().min(1).max(50),
  columns: z.coerce.number().int().min(1).max(50),
  seatsPerBench: z.coerce.number().int().min(1).max(4).default(1),
  isAvailable: z.boolean().optional(),
})

/** Layout (rows/columns) is fixed once benches exist; recreate the room to change it. */
export const roomUpdateSchema = z.object({
  blockId: id.optional(),
  name: requiredText(50).optional(),
  number: requiredText(20).optional(),
  floor: z.coerce.number().int().min(-5).max(200).nullish(),
  isAvailable: z.boolean().optional(),
})

export const roomListQuery = z.object({
  blockId: id.optional(),
  includeUnavailable: booleanParam.optional(),
})

export const benchListQuery = z.object({ roomId: id.optional() })

// ─── Students ───────────────────────────────────────────────────────────────

const studentStatus = z.enum(['active', 'inactive', 'graduated', 'suspended'])

/** "a,b,c" → ["a", "b", "c"] for list filters in query strings. */
const csvList = <T extends z.ZodTypeAny>(item: T, max: number) =>
  z
    .string()
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(item).max(max))

export const studentListQuery = paginationQuery.extend({
  search: z.string().trim().max(100).optional(),
  departmentId: id.optional(),
  departmentIds: csvList(id, 100).optional(),
  courseId: id.optional(),
  semester: z.coerce.number().int().optional(),
  semesters: csvList(z.coerce.number().int().min(1).max(12), 12).optional(),
  section: z.string().trim().max(10).optional(),
  status: z.union([studentStatus, z.literal('all')]).optional(),
  eligibility: z.enum(['eligible', 'ineligible', 'all']).optional(),
  sortBy: z
    .enum(['rollNumber', 'firstName', 'lastName', 'email', 'currentSemester', 'attendancePercentage', 'batchYear', 'createdAt'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

export const studentCreateSchema = z.object({
  rollNumber: requiredText(50),
  registrationNumber: optionalText(50),
  firstName: requiredText(100),
  lastName: requiredText(100),
  email,
  phone: optionalText(30),
  gender: z.enum(['male', 'female', 'other']),
  dateOfBirth: optionalDate,
  bloodGroup: optionalText(5),
  departmentId: id,
  courseId: id,
  currentSemester: z.coerce.number().int().min(1).max(12),
  section: optionalText(10),
  batchYear: z.coerce.number().int().min(1950).max(2100),
  admissionDate: optionalDate,
  address: optionalText(500),
  emergencyContactName: optionalText(100),
  emergencyContactPhone: optionalText(30),
  attendancePercentage: z.coerce.number().min(0).max(100).optional(),
  isEligible: z.boolean().optional(),
  eligibilityOverride: z.boolean().optional(),
  status: studentStatus.optional(),
  password: password.optional(),
})

export const studentUpdateSchema = studentCreateSchema.partial()

export type StudentListQuery = z.infer<typeof studentListQuery>
export type StudentCreateInput = z.infer<typeof studentCreateSchema>
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>

// ─── Teachers ───────────────────────────────────────────────────────────────

const teacherStatus = z.enum(['active', 'inactive', 'on_leave'])

export const teacherListQuery = paginationQuery.extend({
  search: z.string().trim().max(100).optional(),
  departmentId: id.optional(),
  isAvailable: booleanParam.optional(),
  status: z.union([teacherStatus, z.literal('all')]).optional(),
})

export const teacherCreateSchema = z.object({
  employeeId: requiredText(50),
  firstName: requiredText(100),
  lastName: requiredText(100),
  email,
  phone: optionalText(30),
  departmentId: id,
  designation: requiredText(100),
  specialization: optionalText(200),
  qualification: optionalText(200),
  experienceYears: z.coerce.number().int().min(0).max(70).optional(),
  joiningDate: optionalDate,
  maxDutiesPerDay: z.coerce.number().int().min(0).max(10).optional(),
  isAvailable: z.boolean().optional(),
  status: teacherStatus.optional(),
  password: password.optional(),
})

export const teacherUpdateSchema = teacherCreateSchema.partial()

export type TeacherListQuery = z.infer<typeof teacherListQuery>
export type TeacherCreateInput = z.infer<typeof teacherCreateSchema>
export type TeacherUpdateInput = z.infer<typeof teacherUpdateSchema>

// ─── Exams ──────────────────────────────────────────────────────────────────

const examType = z.enum(['mid_sem', 'internal', 'final', 'supplementary', 'practical'])
const examStatus = z.enum(['draft', 'scheduled', 'ongoing', 'completed', 'cancelled'])

export const examListQuery = paginationQuery.extend({
  search: z.string().trim().max(100).optional(),
  examType: examType.optional(),
  status: z.union([examStatus, z.literal('all')]).optional(),
  semester: z.coerce.number().int().optional(),
})

export const examSessionSchema = z
  .object({
    subjectName: z.string().trim().max(200).optional(),
    subjectCode: z.string().trim().max(50).optional(),
    /** Legacy alias of `subjectCode`, sent by older clients. */
    subjectId: z.string().trim().max(50).optional(),
    examDate: dateOnly,
    startTime: hhmm,
    endTime: hhmm,
    durationMinutes: z.coerce.number().int().min(1).max(720),
    maximumMarks: z.coerce.number().int().min(1).max(1000).optional(),
    passingMarks: z.coerce.number().int().min(0).max(1000).optional(),
  })
  .refine((s) => s.subjectName || s.subjectCode || s.subjectId, {
    message: 'Subject name is required',
    path: ['subjectName'],
  })
  .refine((s) => s.endTime > s.startTime, { message: 'End time must be after start time', path: ['endTime'] })

const examFields = z.object({
  name: requiredText(200),
  examType,
  academicYear: requiredText(20),
  semester: z.coerce.number().int().min(1).max(12),
  startDate: dateOnly,
  endDate: dateOnly,
  description: optionalText(2000),
  instructions: optionalText(4000),
})

export const examCreateSchema = examFields
  .extend({ subjects: z.array(examSessionSchema).max(50).optional() })
  .refine((e) => e.endDate >= e.startDate, { message: 'End date cannot be before start date', path: ['endDate'] })

/**
 * Status changes: "draft", "cancelled", or "scheduled" (= published). Published
 * exams then move to ongoing/completed automatically by date; "ongoing" and
 * "completed" are accepted as "published" for older clients.
 */
export const examUpdateSchema = examFields.partial().extend({ status: examStatus.optional() })

/** Every field of a paper is optional on update; the same rules apply to what is sent. */
export const examSessionUpdateSchema = z
  .object({
    subjectName: z.string().trim().min(1).max(200).optional(),
    subjectCode: optionalText(50),
    examDate: dateOnly.optional(),
    startTime: hhmm.optional(),
    endTime: hhmm.optional(),
    maximumMarks: z.coerce.number().int().min(1).max(1000).optional(),
    passingMarks: z.coerce.number().int().min(0).max(1000).optional(),
  })
  .refine((s) => !s.startTime || !s.endTime || s.endTime > s.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  })

export type ExamListQuery = z.infer<typeof examListQuery>
export type ExamCreateInput = z.infer<typeof examCreateSchema>
export type ExamUpdateInput = z.infer<typeof examUpdateSchema>
export type ExamSessionInput = z.infer<typeof examSessionSchema>
export type ExamSessionUpdateInput = z.infer<typeof examSessionUpdateSchema>

// ─── Seat allocation ────────────────────────────────────────────────────────

export const allocateSeatsSchema = z
  .object({
    examId: id,
    /** Papers to seat; omitted = every paper of the exam (same seat throughout). */
    sessionIds: z.array(id).min(1).max(100).optional(),
    studentIds: z.array(id).max(20_000).optional(),
    /** Seat every eligible active student matching these filters instead of listing IDs. */
    selection: z
      .object({
        departmentIds: z.array(id).max(100).optional(),
        semesters: z.array(z.coerce.number().int().min(1).max(12)).max(12).optional(),
      })
      .optional(),
    algorithm: z.enum(['sequential', 'random', 'department_wise', 'anti_cheating']).default('anti_cheating'),
    roomIds: z.array(id).max(500).optional(),
    preventAdjacentSameDept: z.boolean().optional(),
    maxStudentsPerRoom: z.coerce.number().int().min(1).optional(),
    spacingMode: z.enum(['full', 'alternate', 'custom']).optional(),
  })
  .refine((v) => v.selection || (v.studentIds && v.studentIds.length > 0), {
    message: 'Select at least one student',
    path: ['studentIds'],
  })

export type AllocateSeatsInput = z.infer<typeof allocateSeatsSchema>

export const allocationListQuery = z.object({ examId: id.optional(), sessionId: id.optional() })
export const clearAllocationQuery = z.object({ examId: id, sessionId: id.optional() })

export const mySeatQuery = z.object({ studentId: id.optional() })
export const hallTicketQuery = z.object({ examId: id, studentId: id.optional() })

// ─── Invigilation duties ────────────────────────────────────────────────────

const invigilationRole = z.enum(['Chief Invigilator', 'Invigilator', 'Reliever'])

export const assignDutySchema = z.object({
  sessionId: id,
  roomId: id,
  teacherId: id,
  role: invigilationRole.default('Invigilator'),
  notes: optionalText(500),
  /** Assign even when it exceeds the teacher's daily duty limit. */
  override: z.boolean().optional(),
})

export const autoAllocateDutiesSchema = z.object({
  examId: id,
  /** Papers to staff; omitted = every paper of the exam. */
  sessionIds: z.array(id).min(1).max(100).optional(),
  strategy: z.enum(['fair_distribution', 'inter_departmental', 'seniority_based']).default('fair_distribution'),
  invigilatorsPerRoom: z.coerce.number().int().min(1).max(10).default(1),
  invigilatorRatio: z.enum(['fixed', 'ratio_25', 'ratio_30']).optional(),
  maxDutiesOverride: z.coerce.number().int().min(1).max(20).optional(),
  roomIds: z.array(id).max(500).optional(),
})

export type AssignDutyInput = z.infer<typeof assignDutySchema>
export type AutoAllocateDutiesInput = z.infer<typeof autoAllocateDutiesSchema>

export const dutyRosterQuery = z.object({ sessionId: id })
export const workloadQuery = z.object({ sessionId: id.optional(), examId: id.optional() })
export const clearDutiesQuery = z.object({ examId: id, sessionId: id.optional() })
export const myDutiesQuery = z.object({ teacherId: id.optional(), examId: id.optional() })

// ─── Exam-day attendance ────────────────────────────────────────────────────

export const hallQuery = z.object({ sessionId: id, roomId: id })

export const markAttendanceSchema = z.object({
  sessionId: id,
  roomId: id,
  marks: z
    .array(z.object({ allocationId: id, status: z.enum(['present', 'absent']).nullable() }))
    .min(1)
    .max(1000),
})

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>

// ─── Notifications ──────────────────────────────────────────────────────────

export const notifySchema = z.object({
  examId: id,
  channels: z.array(z.enum(['email', 'sms'])).min(1, 'Choose email, SMS or both').max(2),
})

export const notificationListQuery = paginationQuery.extend({
  channel: z.enum(['email', 'sms']).optional(),
  status: z.enum(['sent', 'logged', 'failed']).optional(),
})

// ─── Password reset ─────────────────────────────────────────────────────────

export const forgotPasswordSchema = z.object({
  organization: z.string().trim().max(100).optional(),
  email,
})

export const resetPasswordWithTokenSchema = z.object({
  token: z.string().trim().min(20).max(200),
  password,
})

// ─── Administrators ─────────────────────────────────────────────────────────

const adminRole = z.enum(['ADMIN', 'SUPER_ADMIN'])

export const adminCreateSchema = z.object({
  firstName: requiredText(100),
  lastName: requiredText(100),
  email,
  role: adminRole.default('ADMIN'),
  password: password.optional(),
})

export const adminUpdateSchema = z.object({
  firstName: requiredText(100).optional(),
  lastName: requiredText(100).optional(),
  role: adminRole.optional(),
  isActive: z.boolean().optional(),
})

// ─── Audit log ──────────────────────────────────────────────────────────────

export const auditListQuery = paginationQuery.extend({
  entityType: z.string().trim().max(50).optional(),
  search: z.string().trim().max(100).optional(),
})

// ─── Bulk import ────────────────────────────────────────────────────────────

/** Spreadsheet cells arrive as strings, numbers, booleans or dates; normalise to trimmed strings. */
const cell = z.preprocess((v) => {
  if (v === null || v === undefined) return undefined
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v).trim()
  return s === '' ? undefined : s
}, z.string().max(500).optional())

const requiredCell = (label: string) =>
  z.preprocess((v) => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim()), z.string().min(1, `${label} is required`).max(500))

export const studentImportRowSchema = z.object({
  rollNumber: requiredCell('Roll number'),
  firstName: requiredCell('First name'),
  lastName: requiredCell('Last name'),
  email: requiredCell('Email').pipe(z.string().toLowerCase().email('Email is not valid')),
  gender: requiredCell('Gender').pipe(
    z.string().toLowerCase().refine((g) => ['male', 'female', 'other', 'm', 'f'].includes(g), 'Gender must be male, female or other')
  ),
  department: requiredCell('Department'),
  course: requiredCell('Course'),
  semester: requiredCell('Semester').pipe(z.coerce.number().int().min(1, 'Semester must be 1–12').max(12, 'Semester must be 1–12')),
  batchYear: requiredCell('Batch year').pipe(z.coerce.number().int().min(1950).max(2100)),
  section: cell,
  registrationNumber: cell,
  phone: cell,
  dateOfBirth: cell.pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD')
      .pipe(dateOnly)
      .optional()
  ),
})

export const teacherImportRowSchema = z.object({
  employeeId: requiredCell('Employee ID'),
  firstName: requiredCell('First name'),
  lastName: requiredCell('Last name'),
  email: requiredCell('Email').pipe(z.string().toLowerCase().email('Email is not valid')),
  department: requiredCell('Department'),
  designation: requiredCell('Designation'),
  phone: cell,
  qualification: cell,
  specialization: cell,
  experienceYears: cell.pipe(z.coerce.number().int().min(0).max(70).optional()),
  maxDutiesPerDay: cell.pipe(z.coerce.number().int().min(0).max(10).optional()),
})

export const importSchema = z.object({
  rows: z.array(z.record(z.unknown())).min(1, 'The file has no data rows').max(2000, 'Import at most 2,000 rows at a time'),
  /** Initial password for every imported account. */
  password,
  validateOnly: z.boolean().default(false),
})
