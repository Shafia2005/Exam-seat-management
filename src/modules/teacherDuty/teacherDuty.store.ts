import { create } from 'zustand'
import {
  RoomTeacherDuty,
  ExamDutyRoster,
  TeacherWorkloadStat,
  AutoAllocateDutiesRequest,
  AutoAllocateDutiesResult,
  AssignDutyRequest,
} from '@/types/teacherDuty.types'
import { teacherDutyService } from './teacherDuty.service'
import { errorMessage } from '@/lib/api-client'

interface TeacherDutyState {
  /** Duties of `sessionId` (one paper). */
  duties: RoomTeacherDuty[]
  roster: ExamDutyRoster | null
  /** Duty counts on that paper's day across all exams. */
  workloads: TeacherWorkloadStat[]
  sessionId: string
  isLoading: boolean
  isSubmitting: boolean
  error: string | null

  /** Loads the roster and same-day workload for one paper; '' clears them. */
  loadSession: (sessionId: string) => Promise<void>
  autoAllocate: (request: AutoAllocateDutiesRequest) => Promise<AutoAllocateDutiesResult>
  /** Throws on failure so the caller can react to DUTY_LIMIT (offer an override). */
  assignDuty: (request: AssignDutyRequest) => Promise<RoomTeacherDuty>
  removeDuty: (dutyId: string) => Promise<boolean>
  clearDuties: (examId: string, sessionId?: string) => Promise<void>
}

export const useTeacherDutyStore = create<TeacherDutyState>((set, get) => ({
  duties: [],
  roster: null,
  workloads: [],
  sessionId: '',
  isLoading: false,
  isSubmitting: false,
  error: null,

  loadSession: async (sessionId) => {
    set({ sessionId, isLoading: true, error: null })
    if (!sessionId) return set({ duties: [], roster: null, workloads: [], isLoading: false })
    try {
      const [roster, workloads] = await Promise.all([
        teacherDutyService.getDutyRoster(sessionId),
        teacherDutyService.getTeacherWorkload({ sessionId }),
      ])
      if (get().sessionId === sessionId) set({ roster, duties: roster.duties, workloads, isLoading: false })
    } catch (err) {
      set({ error: errorMessage(err, 'Failed to load the duty roster'), isLoading: false })
    }
  },

  autoAllocate: async (request) => {
    set({ isSubmitting: true, error: null })
    try {
      const result = await teacherDutyService.autoAllocateDuties(request)
      await get().loadSession(get().sessionId)
      set({ isSubmitting: false })
      return result
    } catch (err) {
      set({ error: errorMessage(err, 'Auto-allocation failed'), isSubmitting: false })
      throw err
    }
  },

  assignDuty: async (request) => {
    set({ isSubmitting: true, error: null })
    try {
      const duty = await teacherDutyService.assignDuty(request)
      await get().loadSession(get().sessionId)
      set({ isSubmitting: false })
      return duty
    } catch (err) {
      set({ isSubmitting: false })
      throw err
    }
  },

  removeDuty: async (dutyId) => {
    set({ isSubmitting: true, error: null })
    try {
      await teacherDutyService.removeDuty(dutyId)
      await get().loadSession(get().sessionId)
      set({ isSubmitting: false })
      return true
    } catch (err) {
      set({ error: errorMessage(err, 'Failed to remove duty'), isSubmitting: false })
      return false
    }
  },

  clearDuties: async (examId, sessionId) => {
    set({ isSubmitting: true, error: null })
    try {
      await teacherDutyService.clearDuties(examId, sessionId)
      await get().loadSession(get().sessionId)
      set({ isSubmitting: false })
    } catch (err) {
      set({ error: errorMessage(err, 'Failed to clear duties'), isSubmitting: false })
    }
  },
}))
