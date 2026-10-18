import { BaseEntity } from './common.types'

export type ExamType = 'mid_sem' | 'internal' | 'final' | 'supplementary' | 'practical'
export type ExamStatus = 'draft' | 'scheduled' | 'ongoing' | 'completed' | 'cancelled'

export interface Exam extends BaseEntity {
  name: string
  examType: ExamType
  academicYear: string
  semester: number
  startDate: string
  endDate: string
  description?: string
  instructions?: string
  status: ExamStatus
  createdBy: string
  subjects: ExamSubject[]
}

export interface ExamSubject {
  id: string
  examId: string
  subjectId: string
  subjectName?: string
  examDate: string
  startTime: string
  endTime: string
  durationMinutes: number
  maximumMarks: number
  passingMarks: number
}

export interface CreateExamRequest {
  name: string
  examType: ExamType
  academicYear: string
  semester: number
  startDate: string
  endDate: string
  description?: string
  instructions?: string
}

export interface UpdateExamRequest extends Partial<CreateExamRequest> {
  status?: ExamStatus
}

export interface AddSubjectToExamRequest {
  /** Subject code; optional when `subjectName` is given. */
  subjectId?: string
  subjectName?: string
  examDate: string
  startTime: string
  endTime: string
  durationMinutes: number
  maximumMarks?: number
  passingMarks?: number
}

export interface ExamQuery {
  page?: number
  limit?: number
  search?: string
  examType?: string
  status?: string
  semester?: number
}
