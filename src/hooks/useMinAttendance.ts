import { DEFAULT_MINIMUM_ATTENDANCE } from '@/lib/constants'
import { useAuthStore } from '@/store/auth.store'

/** The institution's minimum attendance percentage for exam eligibility (Settings → Institution). */
export function useMinAttendance(): number {
  return useAuthStore((s) => s.organization?.minAttendancePercent ?? DEFAULT_MINIMUM_ATTENDANCE)
}
