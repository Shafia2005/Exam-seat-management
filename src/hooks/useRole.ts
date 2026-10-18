import { useAuthStore } from '@/store/auth.store'
import { isAdminRole } from '@/lib/auth/roles'
import type { DbUserRole } from '@/types/auth.types'

/** The signed-in user's role, plus convenience flags. */
export function useRole(): { role: DbUserRole; isAdmin: boolean; isTeacher: boolean; isStudent: boolean } {
  const user = useAuthStore((s) => s.user)
  const roles = useAuthStore((s) => s.roles)
  const role: DbUserRole = user?.role ?? ((roles[0]?.toUpperCase() as DbUserRole | undefined) || 'STUDENT')
  return { role, isAdmin: isAdminRole(role), isTeacher: role === 'TEACHER', isStudent: role === 'STUDENT' }
}
