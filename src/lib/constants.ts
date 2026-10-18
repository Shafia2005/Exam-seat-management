// Application Constants
export const APP_NAME = 'SeatGuard'
export const APP_VERSION = '1.0.0'

// API Configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'
export const API_TIMEOUT = 10000 // 10 seconds

// Pagination
export const DEFAULT_PAGE_SIZE = 10
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

// User Roles
export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  EXAM_COORDINATOR: 'exam_coordinator',
  DEPARTMENT_STAFF: 'department_staff',
  TEACHER: 'teacher',
  STUDENT: 'student',
} as const

// Exam Types
export const EXAM_TYPES = {
  MID_SEM: 'mid_sem',
  INTERNAL: 'internal',
  FINAL: 'final',
  SUPPLEMENTARY: 'supplementary',
  PRACTICAL: 'practical',
} as const

// Attendance
export const DEFAULT_MINIMUM_ATTENDANCE = 75
export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
  EXCUSED: 'excused',
} as const

// Student Status
export const STUDENT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  GRADUATED: 'graduated',
  SUSPENDED: 'suspended',
} as const

// Local Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth-token',
  USER_DATA: 'user-data',
  THEME: 'theme',
  SIDEBAR_COLLAPSED: 'sidebar-collapsed',
} as const

// Route Paths
export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  STUDENTS: '/students',
  TEACHERS: '/teachers',
  EXAMS: '/exams',
  SEAT_ALLOCATION: '/seat-allocation',
  REPORTS: '/reports',
  SETTINGS: '/settings',
} as const
