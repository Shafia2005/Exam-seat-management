import { Student, CreateStudentRequest, UpdateStudentRequest, StudentQuery, BulkImportResult, PaginatedResponse } from './students.types'
import { api, errorMessage } from '@/lib/api-client'

class StudentService {
  async getAll(query?: StudentQuery): Promise<PaginatedResponse<Student>> {
    const res = await api.get<Student[]>('/students', query)
    return {
      data: res.data,
      meta: {
        pagination: res.meta.pagination ?? { page: 1, limit: res.data.length, total: res.data.length, totalPages: 1 },
        timestamp: res.meta.timestamp,
        requestId: res.meta.requestId
      }
    }
  }

  async getById(id: string): Promise<Student | null> {
    try {
      const { data } = await api.get<Student>(`/students/${encodeURIComponent(id)}`)
      return data
    } catch {
      return null
    }
  }

  async getByRollNumber(rollNumber: string): Promise<Student | null> {
    const { data } = await this.getAll({ search: rollNumber, limit: 10 })
    return data.find(s => s.rollNumber.toLowerCase() === rollNumber.toLowerCase()) || null
  }

  async create(data: CreateStudentRequest): Promise<Student> {
    const res = await api.post<Student>('/students', data)
    return res.data
  }

  async update(id: string, data: UpdateStudentRequest): Promise<Student> {
    const res = await api.put<Student>(`/students/${encodeURIComponent(id)}`, data)
    return res.data
  }

  async delete(id: string): Promise<void> {
    await api.delete(`/students/${encodeURIComponent(id)}`)
  }

  /** Sets `password`, or generates a temporary one when omitted (returned once). */
  async resetPassword(id: string, password?: string): Promise<{ temporaryPassword?: string }> {
    const { data } = await api.post<{ temporaryPassword?: string }>(`/students/${encodeURIComponent(id)}/reset-password`, { password })
    return data
  }

  async bulkImport(students: CreateStudentRequest[]): Promise<BulkImportResult> {
    const result: BulkImportResult = {
      total: students.length,
      success: 0,
      failed: 0,
      errors: []
    }

    for (let i = 0; i < students.length; i++) {
      try {
        await this.create(students[i])
        result.success++
      } catch (error) {
        result.failed++
        result.errors.push({ row: i + 1, message: errorMessage(error, 'Unknown error') })
      }
    }

    return result
  }

  async exportStudents(filters?: StudentQuery): Promise<Student[]> {
    const { data } = await this.getAll({ ...filters, page: 1, limit: 500 })
    return data
  }

  async updateEligibility(id: string, isEligible: boolean): Promise<Student> {
    return this.update(id, { isEligible, eligibilityOverride: true })
  }

  /** The server recomputes eligibility from attendance unless an override is set. */
  async updateAttendance(id: string, attendancePercentage: number): Promise<Student> {
    return this.update(id, { attendancePercentage })
  }
}

export const studentService = new StudentService()
