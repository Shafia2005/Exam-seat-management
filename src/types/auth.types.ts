import { BaseEntity } from './common.types'

/** Role values as stored in the database (Prisma `UserRole` enum). */
export type DbUserRole = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT'

export interface Organization {
  id: string
  name: string
  slug: string
  code: string
  domain?: string
  logoUrl?: string
  address?: string
  isActive: boolean
  /** Attendance percentage below which students are ineligible. */
  minAttendancePercent: number
  /** IANA timezone, e.g. "Asia/Kolkata". */
  timezone: string
}

export interface User extends BaseEntity {
  email: string
  firstName: string
  lastName: string
  phone?: string
  avatarUrl?: string
  isActive: boolean
  emailVerified: boolean
  lastLogin?: string
  roles: Role[]
  role?: DbUserRole
  organizationId?: string
  // Profile links, present for teacher / student accounts
  teacherId?: string
  employeeId?: string
  designation?: string
  studentId?: string
  rollNumber?: string
  courseName?: string
  currentSemester?: number
  departmentName?: string
}

export interface Role extends BaseEntity {
  name: string
  displayName: string
  description?: string
  permissions: string[]
}

export interface LoginRequest {
  /** Organization slug (e.g. "apex-institute") or code (e.g. "APEX"). */
  organization: string
  /** Email, student roll number, or teacher employee ID. */
  identifier: string
  password: string
}

export interface LoginResponse {
  user: User
  organization: Organization
  /** Also set as an HttpOnly cookie; returned for non-browser API clients. */
  token: string
  expiresAt: string
  permissions: string[]
  roles: UserRole[]
}

export interface RegisterOrganizationRequest {
  organization: {
    name: string
    slug: string
    code?: string
    domain?: string
    address?: string
    logoUrl?: string
  }
  admin: {
    firstName: string
    lastName: string
    email: string
    password: string
  }
}

export type UserRole = 'super_admin' | 'admin' | 'exam_coordinator' | 'department_staff' | 'teacher' | 'student'

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: ['*'], // All permissions
  admin: [
    'users:view', 'users:create', 'users:update', 'users:delete',
    'students:view', 'students:create', 'students:update', 'students:delete',
    'teachers:view', 'teachers:create', 'teachers:update', 'teachers:delete',
    'exams:view', 'exams:create', 'exams:update', 'exams:delete',
    'seat_allocation:view', 'seat_allocation:create', 'seat_allocation:update',
    'reports:view', 'reports:generate',
  ],
  exam_coordinator: [
    'exams:view', 'exams:create', 'exams:update',
    'seat_allocation:view', 'seat_allocation:create', 'seat_allocation:update',
    'students:view', 'students:view_details',
    'teachers:view', 'teachers:view_details',
    'reports:view',
  ],
  department_staff: [
    'students:view', 'students:create', 'students:update',
    'teachers:view', 'teachers:create', 'teachers:update',
    'courses:view', 'courses:create', 'courses:update',
    'subjects:view', 'subjects:create', 'subjects:update',
    'attendance:view', 'attendance:mark',
    'reports:view',
  ],
  teacher: [
    'students:view', 'students:view_details',
    'exams:view',
    'attendance:view', 'attendance:mark',
  ],
  student: [
    'students:view_own',
    'exams:view_own',
    'seat_allocation:view_own',
  ],
}
