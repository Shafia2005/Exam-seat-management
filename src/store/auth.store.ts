import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Organization, User, UserRole } from '@/types/auth.types'

interface AuthState {
  user: User | null
  organization: Organization | null
  /** In-memory only: the session itself lives in an HttpOnly cookie. */
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  permissions: string[]
  roles: UserRole[]

  // Actions
  login: (user: User, token: string | null, permissions: string[], roles: UserRole[], organization?: Organization | null) => void
  logout: () => void
  setUser: (user: User) => void
  updatePermissions: (permissions: string[]) => void
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasRole: (role: UserRole) => boolean
  hasAnyRole: (roles: UserRole[]) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      organization: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      permissions: [],
      roles: [],

      login: (user, token, permissions, roles, organization = null) => {
        set({
          user,
          organization,
          token,
          isAuthenticated: true,
          isLoading: false,
          permissions,
          roles,
        })
      },

      logout: () => {
        set({
          user: null,
          organization: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          permissions: [],
          roles: [],
        })
      },

      setUser: (user) => {
        set({ user, isAuthenticated: !!user })
      },

      updatePermissions: (permissions) => {
        set({ permissions })
      },

      hasPermission: (permission) => {
        const { permissions, roles } = get()
        if (roles.includes('super_admin')) return true
        return permissions.includes(permission) || permissions.includes('*')
      },

      hasAnyPermission: (permissions) => {
        const { permissions: userPermissions, roles } = get()
        if (roles.includes('super_admin')) return true
        return permissions.some(p => userPermissions.includes(p))
      },

      hasRole: (role) => {
        const { roles: userRoles } = get()
        return userRoles.includes(role)
      },

      hasAnyRole: (roles) => {
        const { roles: userRoles } = get()
        return roles.some(r => userRoles.includes(r))
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        organization: state.organization,
        isAuthenticated: state.isAuthenticated,
        permissions: state.permissions,
        roles: state.roles,
      }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ isLoading: false })
      },
    }
  )
)
