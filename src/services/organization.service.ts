import { api } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth.store'
import type { Organization } from '@/types/auth.types'

export interface OrganizationUpdate {
  name?: string
  address?: string | null
  logoUrl?: string | null
  domain?: string | null
  minAttendancePercent?: number
  timezone?: string
}

class OrganizationService {
  async get(): Promise<Organization> {
    const { data } = await api.get<Organization>('/organization')
    return data
  }

  /**
   * Saves institution details and refreshes the copy shown in the app shell.
   * `eligibilityChanged` counts students re-evaluated after a threshold change.
   */
  async update(input: OrganizationUpdate): Promise<Organization & { eligibilityChanged?: number }> {
    const { data } = await api.patch<Organization & { eligibilityChanged?: number }>('/organization', input)
    const { eligibilityChanged: _ignored, ...organization } = data
    useAuthStore.setState({ organization })
    return data
  }
}

export const organizationService = new OrganizationService()
