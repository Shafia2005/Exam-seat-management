import { Exam, CreateExamRequest, UpdateExamRequest, AddSubjectToExamRequest, ExamQuery, PaginatedResponse } from './exams.types'
import { api } from '@/lib/api-client'

class ExamService {
  async getAll(query?: ExamQuery): Promise<PaginatedResponse<Exam>> {
    const res = await api.get<Exam[]>('/exams', query)
    return {
      data: res.data,
      meta: {
        pagination: res.meta.pagination ?? { page: 1, limit: res.data.length, total: res.data.length, totalPages: 1 },
        timestamp: res.meta.timestamp,
        requestId: res.meta.requestId
      }
    }
  }

  async getById(id: string): Promise<Exam | null> {
    try {
      const { data } = await api.get<Exam>(`/exams/${encodeURIComponent(id)}`)
      return data
    } catch {
      return null
    }
  }

  async getActiveExams(): Promise<Exam[]> {
    const { data } = await this.getAll({ limit: 500 })
    return data.filter(e => e.status === 'scheduled' || e.status === 'ongoing')
  }

  async create(data: CreateExamRequest): Promise<Exam> {
    const res = await api.post<Exam>('/exams', data)
    return res.data
  }

  async update(id: string, data: UpdateExamRequest): Promise<Exam> {
    const res = await api.put<Exam>(`/exams/${encodeURIComponent(id)}`, data)
    return res.data
  }

  async delete(id: string): Promise<void> {
    await api.delete(`/exams/${encodeURIComponent(id)}`)
  }

  async publish(id: string): Promise<Exam> {
    return this.update(id, { status: 'scheduled' })
  }

  async cancel(id: string): Promise<Exam> {
    return this.update(id, { status: 'cancelled' })
  }

  async addSubject(examId: string, data: AddSubjectToExamRequest): Promise<Exam> {
    const res = await api.post<Exam>(`/exams/${encodeURIComponent(examId)}/sessions`, data)
    return res.data
  }

  /** Edits a paper; returns the updated exam. */
  async updateSubject(
    examId: string,
    sessionId: string,
    data: Partial<Omit<AddSubjectToExamRequest, 'subjectId'>> & { subjectCode?: string | null }
  ): Promise<Exam> {
    const res = await api.patch<Exam>(`/exams/${encodeURIComponent(examId)}/sessions/${encodeURIComponent(sessionId)}`, data)
    return res.data
  }

  /** Removes a paper with its seating and duties; returns the updated exam. */
  async deleteSubject(examId: string, sessionId: string): Promise<Exam> {
    const res = await api.delete<Exam>(`/exams/${encodeURIComponent(examId)}/sessions/${encodeURIComponent(sessionId)}`)
    return res.data
  }
}

export const examService = new ExamService()
