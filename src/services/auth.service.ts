import { api } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth.store'
import type { LoginRequest, LoginResponse, RegisterOrganizationRequest } from '@/types/auth.types'

export type SessionInfo = Omit<LoginResponse, 'token' | 'expiresAt'>

export const DEFAULT_ORG_SLUG = process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG || ''
export const DEMO_LOGIN_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === 'true'
/** The seeded demo organization. Demo shortcuts only ever sign in here. */
export const DEMO_ORG_SLUG = process.env.NEXT_PUBLIC_DEMO_ORG_SLUG || 'apex-institute'

/** True when demo shortcuts apply to this organization (never for real institutions). */
export const isDemoOrganization = (slug: string | null | undefined) => DEMO_LOGIN_ENABLED && slug === DEMO_ORG_SLUG

/** Seeded demo accounts (see prisma/seed.ts), used by the demo sign-in shortcuts. */
export const DEMO_CREDENTIALS = {
  admin: { identifier: 'admin@example.com', password: 'admin123' },
  teacher: { identifier: 'teacher@example.com', password: 'teacher123' },
  student: { identifier: 'student@example.com', password: 'student123' },
} as const

export type DemoRole = keyof typeof DEMO_CREDENTIALS

function storeSession(session: LoginResponse | SessionInfo) {
  const token = 'token' in session ? session.token : null
  useAuthStore.getState().login(session.user, token, session.permissions, session.roles, session.organization)
}

class AuthService {
  async login(request: LoginRequest): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/login', request)
    storeSession(data)
    return data
  }

  async signInAs(role: DemoRole): Promise<LoginResponse> {
    return this.login({ organization: DEMO_ORG_SLUG, ...DEMO_CREDENTIALS[role] })
  }

  async registerOrganization(request: RegisterOrganizationRequest): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/register-org', request)
    storeSession(data)
    return data
  }

  /** Changes the signed-in user's password; other sessions are signed out. */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const { data } = await api.post<LoginResponse>('/auth/change-password', { currentPassword, newPassword })
    storeSession(data)
  }

  /** Refreshes the stored profile from the server (role or account changes apply immediately). */
  async me(): Promise<SessionInfo> {
    const { data } = await api.get<SessionInfo>('/auth/me')
    storeSession(data)
    return data
  }

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout')
    } finally {
      useAuthStore.getState().logout()
    }
  }
}

export const authService = new AuthService()
