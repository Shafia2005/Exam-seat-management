import { BaseEntity } from './common.types'
import type { Student } from './student.types'
import type { InvigilationRole } from './teacherDuty.types'

export interface Block extends BaseEntity {
  name: string
  code: string
  capacity: number
  floor: number
  buildingName: string
  isActive: boolean
  roomCount?: number
}

export interface Room extends BaseEntity {
  name: string
  number: string
  blockId: string
  blockName?: string
  capacity: number
  rows: number
  columns: number
  isAvailable: boolean
  floor?: number
  benchCount?: number
}

export interface Bench extends BaseEntity {
  number: string
  roomId: string
  roomNumber?: string
  row: number
  column: number
  studentId?: string
  examId?: string
}

/** Exam-day attendance for one seat. */
export type AttendanceMark = 'present' | 'absent'

/** The seating plan for one paper (exam session). */
export interface SeatAllocation extends BaseEntity {
  examId: string
  examName?: string
  sessionId: string
  subjectName: string
  examDate: string
  startTime: string
  endTime: string
  allocations: Allocation[]
}

export interface Allocation {
  /** Seat allocation row ID (used for attendance). */
  id?: string
  sessionId?: string
  studentId: string
  studentName?: string
  studentRollNumber?: string
  departmentId?: string
  departmentName?: string
  benchId: string
  benchNumber?: string
  roomId: string
  roomNumber?: string
  row: number
  column: number
  blockId: string
  blockName?: string
  seatPosition?: number
  /** Human-readable seat, e.g. "B5" (row B, column 5). */
  seatLabel?: string
  attendanceStatus?: AttendanceMark | null
}

/** A student's seat for one paper, as returned by `GET /api/seats/my-seat`. */
export interface StudentSeatAssignment extends Allocation {
  examId: string
  examName: string
  sessionId: string
  subjectName: string
  examDate: string
  startTime: string
  endTime: string
  invigilators: { teacherName: string; employeeId: string; role: InvigilationRole }[]
}

export interface MySeatResponse {
  student: Student
  allocations: StudentSeatAssignment[]
  /** Signed tokens encoded in each exam's hall-ticket QR code. */
  hallTickets: { examId: string; token: string }[]
}

export type AllocationAlgorithm =
  | 'sequential'
  | 'random'
  | 'department_wise'
  | 'anti_cheating'

/** Select every eligible active student matching these filters (server-side). */
export interface CandidateSelection {
  departmentIds?: string[]
  semesters?: number[]
}

export interface CreateAllocationRequest {
  examId: string
  /** Papers to seat; defaults to every paper of the exam (same seat throughout). */
  sessionIds?: string[]
  /** Explicit students, or use `selection` to seat everyone matching filters. */
  studentIds?: string[]
  selection?: CandidateSelection
  algorithm: AllocationAlgorithm
  roomIds?: string[]
  preventAdjacentSameDept?: boolean
  maxStudentsPerRoom?: number
  spacingMode?: 'full' | 'alternate' | 'custom'
}

export interface AllocationResult {
  totalStudents: number
  allocatedStudents: number
  failedAllocations: number
  /** Seats for the first seated paper (every seated paper uses the same plan). */
  allocations: Allocation[]
  errors: { studentId: string; error: string }[]
  algorithm?: AllocationAlgorithm
  adjacentSameDeptPairs?: number
  sessionIds?: string[]
}

export interface AllocationQuery {
  examId?: string
  sessionId?: string
  blockId?: string
  roomId?: string
  studentId?: string
}

/** Seat counts without the individual seats, from `GET /api/seats/summary`. */
export interface AllocationSummary {
  exams: { examId: string; students: number; seats: number; papers: number }[]
  rooms: { examId: string; sessionId: string; roomId: string; count: number }[]
}
