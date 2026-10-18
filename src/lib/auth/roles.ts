// Role rules shared by middleware (Edge runtime), API handlers and the client.
// Keep this file free of Node-only imports.

import { ROLE_PERMISSIONS, type DbUserRole, type UserRole } from '@/types/auth.types'

export const ADMIN_ROLES: readonly DbUserRole[] = ['SUPER_ADMIN', 'ADMIN']
export const STAFF_ROLES: readonly DbUserRole[] = ['SUPER_ADMIN', 'ADMIN', 'TEACHER']
export const ALL_ROLES: readonly DbUserRole[] = ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT']

export const ROLE_HOME: Record<DbUserRole, string> = {
  SUPER_ADMIN: '/dashboard',
  ADMIN: '/dashboard',
  TEACHER: '/my-duties',
  STUDENT: '/my-seat',
}

export const ROLE_DISPLAY_NAME: Record<DbUserRole, string> = {
  SUPER_ADMIN: 'Super Administrator',
  ADMIN: 'Administrator',
  TEACHER: 'Faculty / Invigilator',
  STUDENT: 'Student',
}

/**
 * Dashboard pages and the roles allowed to open them. Admins can also open the
 * teacher and student portals to preview any faculty member's or student's view.
 */
export const PAGE_ACCESS: readonly { prefix: string; roles: readonly DbUserRole[] }[] = [
  { prefix: '/dashboard', roles: ADMIN_ROLES },
  { prefix: '/students', roles: ADMIN_ROLES },
  { prefix: '/teachers', roles: ADMIN_ROLES },
  { prefix: '/seat-allocation', roles: ADMIN_ROLES },
  { prefix: '/reports', roles: ADMIN_ROLES },
  { prefix: '/settings', roles: ADMIN_ROLES },
  { prefix: '/activity', roles: ADMIN_ROLES },
  { prefix: '/teacher-allocation', roles: STAFF_ROLES },
  { prefix: '/my-duties', roles: STAFF_ROLES },
  { prefix: '/attendance', roles: STAFF_ROLES },
  { prefix: '/my-seat', roles: [...ADMIN_ROLES, 'STUDENT'] },
  { prefix: '/exams', roles: ALL_ROLES },
]

/** API routes reachable without a session. */
export const PUBLIC_API_ROUTES: readonly string[] = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register-org',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
]

export function isDbUserRole(value: unknown): value is DbUserRole {
  return typeof value === 'string' && (ALL_ROLES as readonly string[]).includes(value)
}

export function isAdminRole(role: DbUserRole | undefined | null): boolean {
  return !!role && ADMIN_ROLES.includes(role)
}

/** Roles allowed on a page, or `null` when the path is not a protected page. */
export function rolesForPage(pathname: string): readonly DbUserRole[] | null {
  const rule = PAGE_ACCESS.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`))
  return rule ? rule.roles : null
}

export function canAccessPage(pathname: string, role: DbUserRole): boolean {
  const roles = rolesForPage(pathname)
  return roles === null || roles.includes(role)
}

/** Maps a database role to the lower-case role names used by the client stores. */
export function toClientRole(role: DbUserRole): UserRole {
  return role.toLowerCase() as UserRole
}

export function permissionsFor(role: DbUserRole): string[] {
  return ROLE_PERMISSIONS[toClientRole(role)]
}
