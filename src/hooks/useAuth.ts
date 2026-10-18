import { useAuthStore } from '@/store/auth.store'
import { useCallback } from 'react'

export const useAuth = () => {
  const {
    user,
    organization,
    token,
    isAuthenticated,
    isLoading,
    permissions,
    roles,
    login,
    logout,
    hasPermission,
    hasAnyPermission,
    hasRole,
    hasAnyRole,
  } = useAuthStore()

  const canAccess = useCallback((requiredPermissions: string[]) => {
    return hasAnyPermission(requiredPermissions)
  }, [hasAnyPermission])

  const isAdmin = useCallback(() => {
    return roles.includes('admin') || roles.includes('super_admin')
  }, [roles])

  const isSuperAdmin = useCallback(() => {
    return roles.includes('super_admin')
  }, [roles])

  return {
    user,
    organization,
    token,
    isAuthenticated,
    isLoading,
    permissions,
    roles,
    login,
    logout,
    hasPermission,
    hasAnyPermission,
    hasRole,
    hasAnyRole,
    canAccess,
    isAdmin,
    isSuperAdmin,
  }
}
