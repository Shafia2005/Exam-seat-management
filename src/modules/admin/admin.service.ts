// Client services for exam-day attendance, notifications, administrators,
// the change history and bulk import.

import { api } from '@/lib/api-client'
import type {
  AdminUser,
  AttendanceSummaryRow,
  AuditLogEntry,
  CreateAdminRequest,
  HallAttendance,
  ImportResult,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationLogEntry,
} from '@/types/admin.types'
import type { AttendanceMark } from '@/types/seat.types'

export interface Page<T> {
  rows: T[]
  total: number
  totalPages: number
}

function toPage<T>(rows: T[], meta: { pagination?: { total: number; totalPages: number } }): Page<T> {
  return { rows, total: meta.pagination?.total ?? rows.length, totalPages: meta.pagination?.totalPages ?? 1 }
}

export const attendanceService = {
  async getHall(sessionId: string, roomId: string): Promise<HallAttendance> {
    const { data } = await api.get<HallAttendance>('/attendance', { sessionId, roomId })
    return data
  },

  async mark(sessionId: string, roomId: string, marks: { allocationId: string; status: AttendanceMark | null }[]): Promise<HallAttendance> {
    const { data } = await api.put<HallAttendance>('/attendance', { sessionId, roomId, marks })
    return data
  },

  async summary(examId: string): Promise<AttendanceSummaryRow[]> {
    const { data } = await api.get<AttendanceSummaryRow[]>('/attendance/summary', { examId })
    return data
  },
}

export const notificationService = {
  async list(query: { page: number; limit: number; channel?: NotificationChannel; status?: NotificationLogEntry['status'] }) {
    const { data, meta } = await api.get<NotificationLogEntry[]>('/notifications', query)
    return toPage(data, meta)
  },

  async status(): Promise<NotificationDeliveryStatus> {
    const { data } = await api.get<NotificationDeliveryStatus>('/notifications/status')
    return data
  },
}

export const auditService = {
  async list(query: { page: number; limit: number; entityType?: string; search?: string }) {
    const { data, meta } = await api.get<AuditLogEntry[]>('/audit-logs', query)
    return toPage(data, meta)
  },
}

export const adminService = {
  async list(): Promise<AdminUser[]> {
    const { data } = await api.get<AdminUser[]>('/admins')
    return data
  },

  async create(input: CreateAdminRequest): Promise<{ admin: AdminUser; temporaryPassword?: string }> {
    const { data, meta } = await api.post<AdminUser>('/admins', input)
    return { admin: data, temporaryPassword: meta.temporaryPassword as string | undefined }
  },

  async update(id: string, input: Partial<Pick<AdminUser, 'firstName' | 'lastName' | 'role' | 'isActive'>>): Promise<AdminUser> {
    const { data } = await api.patch<AdminUser>(`/admins/${encodeURIComponent(id)}`, input)
    return data
  },

  async resetPassword(id: string, password?: string): Promise<{ temporaryPassword?: string }> {
    const { data } = await api.post<{ temporaryPassword?: string }>(`/admins/${encodeURIComponent(id)}/reset-password`, { password })
    return data
  },
}

export const importService = {
  async run(
    kind: 'students' | 'teachers',
    rows: Record<string, unknown>[],
    options: { password: string; validateOnly: boolean }
  ): Promise<ImportResult> {
    const { data } = await api.post<ImportResult>(`/${kind}/import`, { rows, ...options })
    return data
  },
}
