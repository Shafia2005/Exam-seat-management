import {
  RoomTeacherDuty,
  ExamDutyRoster,
  AutoAllocateDutiesRequest,
  AutoAllocateDutiesResult,
  AssignDutyRequest,
  TeacherWorkloadStat,
  MyDutiesResponse,
} from '@/types/teacherDuty.types'
import type { NotificationChannel, NotifyResult } from '@/types/admin.types'
import { api } from '@/lib/api-client'

// Duty allocation strategies run on the server (src/server/services/duties.service.ts).
class TeacherDutyService {
  /** Roster for one paper. */
  async getDutyRoster(sessionId: string): Promise<ExamDutyRoster> {
    const { data } = await api.get<ExamDutyRoster>('/duties', { sessionId })
    return data
  }

  /** Duty counts per teacher on the paper's day (all exams), or overall within an exam. */
  async getTeacherWorkload(query: { sessionId?: string; examId?: string } = {}): Promise<TeacherWorkloadStat[]> {
    const { data } = await api.get<TeacherWorkloadStat[]>('/duties/workload', query)
    return data
  }

  async autoAllocateDuties(request: AutoAllocateDutiesRequest): Promise<AutoAllocateDutiesResult> {
    const { data } = await api.post<AutoAllocateDutiesResult>('/duties/auto-allocate', request)
    return data
  }

  async assignDuty(request: AssignDutyRequest): Promise<RoomTeacherDuty> {
    const { data } = await api.post<RoomTeacherDuty>('/duties', request)
    return data
  }

  async removeDuty(dutyId: string): Promise<boolean> {
    await api.delete(`/duties/${encodeURIComponent(dutyId)}`)
    return true
  }

  /** Clears every paper of the exam, or only `sessionId`. */
  async clearDuties(examId: string, sessionId?: string): Promise<void> {
    await api.delete('/duties', { examId, sessionId })
  }

  async notifyInvigilators(examId: string, channels: NotificationChannel[]): Promise<NotifyResult> {
    const { data } = await api.post<NotifyResult>('/duties/notify', { examId, channels })
    return data
  }

  /** The signed-in teacher's duties; admins may pass a `teacherId` to preview. */
  async getMyDuties(params: { teacherId?: string; examId?: string } = {}): Promise<MyDutiesResponse> {
    const { data } = await api.get<MyDutiesResponse>('/duties/my-duties', params)
    return data
  }
}

export const teacherDutyService = new TeacherDutyService()
