import { BaseEntity } from './common.types'

export interface Department extends BaseEntity {
  name: string
  code: string
  description?: string
  studentCount?: number
  teacherCount?: number
  courseCount?: number
}

export interface Course extends BaseEntity {
  name: string
  code: string
  departmentId: string
  departmentName?: string
  durationYears: number
  studentCount?: number
}
