import type { DbUserRole } from './auth.types'
import type { AttendanceCounts } from './teacherDuty.types'
import type { AttendanceMark } from './seat.types'

// ─── Administrators ─────────────────────────────────────────────────────────

export interface AdminUser {
  id: string
  firstName: string
  lastName: string
  email: string
  role: Extract<DbUserRole, 'ADMIN' | 'SUPER_ADMIN'>
  isActive: boolean
  lastLogin?: string
  createdAt: string
}

export interface CreateAdminRequest {
  firstName: string
  lastName: string
  email: string
  role: AdminUser['role']
  password?: string
}

// ─── Audit log ──────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string
  actorId?: string
  actorName: string
  action: string
  entityType: string
  entityId?: string
  summary: string
  metadata?: Record<string, unknown>
  createdAt: string
}

// ─── Notifications ──────────────────────────────────────────────────────────

export type NotificationChannel = 'email' | 'sms'

export interface NotificationLogEntry {
  id: string
  channel: NotificationChannel
  recipient: string
  recipientName?: string
  subject?: string
  body: string
  status: 'sent' | 'logged' | 'failed'
  error?: string
  relatedType?: string
  createdAt: string
}

export interface NotificationDeliveryStatus {
  /** "smtp" when an SMTP server is configured, otherwise messages are only logged. */
  email: 'smtp' | 'log'
  /** "twilio" when Twilio is configured, otherwise messages are only logged. */
  sms: 'twilio' | 'log'
}

export interface NotifyResult {
  recipients: number
  sent: number
  logged: number
  failed: number
  skipped: number
}

// ─── Exam-day attendance ────────────────────────────────────────────────────

export interface HallAttendanceSeat {
  allocationId: string
  studentId: string
  rollNumber: string
  studentName: string
  departmentName: string
  seatLabel: string
  benchNumber: string
  row: number
  column: number
  status: AttendanceMark | null
  markedAt?: string
}

export interface HallAttendance {
  examId: string
  examName: string
  sessionId: string
  subjectName: string
  examDate: string
  startTime: string
  endTime: string
  roomId: string
  roomName: string
  blockName: string
  /** False before the paper's date or for cancelled exams. */
  open: boolean
  canMark: boolean
  invigilators: { teacherName: string; role: string }[]
  seats: HallAttendanceSeat[]
  summary: AttendanceCounts
}

export interface AttendanceSummaryRow {
  sessionId: string
  subjectName: string
  examDate: string
  startTime: string
  endTime: string
  rooms: ({ roomId: string; roomName: string } & AttendanceCounts)[]
  totals: AttendanceCounts
}

// ─── Bulk import ────────────────────────────────────────────────────────────

export interface ImportResult {
  total: number
  created: number
  failed: number
  /** `row` is 1-based and counts data rows (excluding the header). */
  errors: { row: number; message: string }[]
  validateOnly: boolean
}
