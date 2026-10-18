import { BaseEntity } from './common.types'
import type { Teacher } from './teacher.types'

export type InvigilationRole = 'Chief Invigilator' | 'Invigilator' | 'Reliever'

/** A teacher's duty in one room for one paper (exam session). */
export interface RoomTeacherDuty extends BaseEntity {
  examId: string
  examName?: string
  sessionId: string
  subjectName: string
  startTime: string
  endTime: string
  roomId: string
  roomNumber: string
  blockId?: string
  blockName?: string
  teacherId: string
  teacherName: string
  employeeId: string
  teacherDepartment?: string
  designation?: string
  role: InvigilationRole
  sessionDate?: string
  sessionSlot?: string
  studentCount?: number
  maxDutiesPerDay?: number
  assignedDutiesCount?: number
  status: 'assigned' | 'confirmed' | 'substituted'
  notes?: string
}

export interface AttendanceCounts {
  total: number
  present: number
  absent: number
  pending: number
}

/** A duty plus the other invigilators sharing the room, from `GET /api/duties/my-duties`. */
export interface MyDutyAssignment extends RoomTeacherDuty {
  coInvigilators: { id: string; teacherId: string; teacherName: string; employeeId: string; role: InvigilationRole }[]
  attendance: AttendanceCounts
  /** Whether exam-day attendance can be taken now (paper date has arrived). */
  attendanceOpen: boolean
}

export interface MyDutiesResponse {
  teacher: Teacher
  duties: MyDutyAssignment[]
}

/** Roster for one paper. */
export interface ExamDutyRoster {
  examId: string
  examName: string
  sessionId: string
  subjectName: string
  startTime: string
  endTime: string
  examDate?: string
  sessionSlot?: string
  totalRooms: number
  totalAssignedDuties: number
  unassignedRoomsCount: number
  duties: RoomTeacherDuty[]
  updatedAt: string
}

export type AutoAllocationStrategy =
  | 'fair_distribution'       // Balances duty count across all available faculty
  | 'inter_departmental'      // Avoids faculty from same department as primary room subject/students
  | 'seniority_based'         // Senior professors as Chief Invigilators, Asst Profs as Invigilators

export interface AutoAllocateDutiesRequest {
  examId: string
  /** Papers to staff; defaults to every paper of the exam. */
  sessionIds?: string[]
  strategy: AutoAllocationStrategy
  invigilatorsPerRoom?: number
  invigilatorRatio?: 'fixed' | 'ratio_25' | 'ratio_30'
  maxDutiesOverride?: number
  roomIds?: string[]
}

export interface AutoAllocateDutiesResult {
  created: number
  sessions: number
  warnings: string[]
}

export interface AssignDutyRequest {
  sessionId: string
  roomId: string
  teacherId: string
  role?: InvigilationRole
  notes?: string
  /** Assign even if it exceeds the teacher's daily duty limit. */
  override?: boolean
}

export interface TeacherWorkloadStat {
  teacherId: string
  teacherName: string
  employeeId: string
  departmentName: string
  designation: string
  maxDutiesPerDay: number
  /** Duties on the paper's date across all exams (or within the exam when no paper is given). */
  currentDutiesCount: number
  isAvailable: boolean
  status: 'active' | 'inactive' | 'on_leave'
  /** Already invigilating another paper at an overlapping time. */
  busy?: boolean
}
