import { Teacher, CreateTeacherRequest, UpdateTeacherRequest, TeacherQuery, PaginatedResponse } from './teachers.types'
import { api } from '@/lib/api-client'

class TeacherService {
  async getAll(query?: TeacherQuery): Promise<PaginatedResponse<Teacher>> {
    const res = await api.get<Teacher[]>('/teachers', query)
    return {
      data: res.data,
      meta: {
        pagination: res.meta.pagination ?? { page: 1, limit: res.data.length, total: res.data.length, totalPages: 1 },
        timestamp: res.meta.timestamp,
        requestId: res.meta.requestId
      }
    }
  }

  async getById(id: string): Promise<Teacher | null> {
    try {
      const { data } = await api.get<Teacher>(`/teachers/${encodeURIComponent(id)}`)
      return data
    } catch {
      return null
    }
  }

  async getAvailable(): Promise<Teacher[]> {
    const { data } = await this.getAll({ isAvailable: true, status: 'active', limit: 500 })
    return data
  }

  async create(data: CreateTeacherRequest): Promise<Teacher> {
    const res = await api.post<Teacher>('/teachers', data)
    return res.data
  }

  async update(id: string, data: UpdateTeacherRequest): Promise<Teacher> {
    const res = await api.put<Teacher>(`/teachers/${encodeURIComponent(id)}`, data)
    return res.data
  }

  async delete(id: string): Promise<void> {
    await api.delete(`/teachers/${encodeURIComponent(id)}`)
  }

  /** Sets `password`, or generates a temporary one when omitted (returned once). */
  async resetPassword(id: string, password?: string): Promise<{ temporaryPassword?: string }> {
    const { data } = await api.post<{ temporaryPassword?: string }>(`/teachers/${encodeURIComponent(id)}/reset-password`, { password })
    return data
  }
}

export const teacherService = new TeacherService()
