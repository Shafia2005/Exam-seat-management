import { BaseEntity } from './common.types'

export interface Teacher extends BaseEntity {
  employeeId: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  departmentId: string
  departmentName?: string
  designation: string
  specialization?: string
  qualification?: string
  experienceYears: number
  joiningDate?: string
  isAvailable: boolean
  maxDutiesPerDay: number
  status: 'active' | 'inactive' | 'on_leave'
}

export interface CreateTeacherRequest {
  employeeId: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  departmentId: string
  designation: string
  specialization?: string
  qualification?: string
  experienceYears?: number
  joiningDate?: string
  maxDutiesPerDay?: number
  /** Initial login password; the API generates one when omitted. */
  password?: string
}

export interface UpdateTeacherRequest extends Partial<CreateTeacherRequest> {
  isAvailable?: boolean
  status?: 'active' | 'inactive' | 'on_leave'
}

export interface TeacherQuery {
  page?: number
  limit?: number
  search?: string
  departmentId?: string
  isAvailable?: boolean
  status?: string
}
