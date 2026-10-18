import { BaseEntity } from './common.types'

export interface Student extends BaseEntity {
  rollNumber: string
  registrationNumber?: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  gender: 'male' | 'female' | 'other'
  dateOfBirth?: string
  bloodGroup?: string
  departmentId: string
  departmentName?: string
  courseId: string
  courseName?: string
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
  status: 'active' | 'inactive' | 'graduated' | 'suspended'
  avatarUrl?: string
}

export interface CreateStudentRequest {
  rollNumber: string
  registrationNumber?: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  gender: 'male' | 'female' | 'other'
  dateOfBirth?: string
  bloodGroup?: string
  departmentId: string
  courseId: string
  currentSemester: number
  section?: string
  batchYear: number
  admissionDate?: string
  address?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  /** Initial login password; the API generates one when omitted. */
  password?: string
}

export interface UpdateStudentRequest extends Partial<CreateStudentRequest> {
  attendancePercentage?: number
  isEligible?: boolean
  eligibilityOverride?: boolean
  status?: 'active' | 'inactive' | 'graduated' | 'suspended'
}

export interface StudentFilters {
  search?: string
  departmentId?: string
  courseId?: string
  semester?: number
  section?: string
  status?: 'active' | 'inactive' | 'graduated' | 'suspended' | 'all'
  eligibility?: 'eligible' | 'ineligible' | 'all'
}

export interface StudentQuery {
  page?: number
  limit?: number
  search?: string
  departmentId?: string
  /** Comma-separated department IDs (any of). */
  departmentIds?: string
  courseId?: string
  semester?: number
  /** Comma-separated semesters (any of). */
  semesters?: string
  section?: string
  status?: string
  eligibility?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface BulkImportResult {
  total: number
  success: number
  failed: number
  errors: { row: number; message: string }[]
}
