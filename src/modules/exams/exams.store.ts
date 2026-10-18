import { create } from 'zustand'
import { errorMessage } from '@/lib/api-client'
import { Exam, ExamQuery, CreateExamRequest, UpdateExamRequest } from './exams.types'
import { examService } from './exams.service'

interface ExamsState {
  exams: Exam[]
  selectedExam: Exam | null
  pagination: { page: number; limit: number; total: number; totalPages: number }
  isLoading: boolean
  isSubmitting: boolean
  error: string | null
  filters: ExamQuery
  fetchExams: (query?: ExamQuery) => Promise<void>
  createExam: (data: CreateExamRequest) => Promise<Exam | null>
  updateExam: (id: string, data: UpdateExamRequest) => Promise<Exam | null>
  deleteExam: (id: string) => Promise<boolean>
  publishExam: (id: string) => Promise<Exam | null>
  cancelExam: (id: string) => Promise<Exam | null>
  setFilters: (filters: Partial<ExamQuery>) => void
  setPage: (page: number) => void
}

const defaultFilters: ExamQuery = { page: 1, limit: 10, search: '', status: 'all' }

export const useExamsStore = create<ExamsState>((set, get) => ({
  exams: [],
  selectedExam: null,
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  isLoading: false,
  isSubmitting: false,
  error: null,
  filters: defaultFilters,

  fetchExams: async (query) => {
    set({ isLoading: true, error: null })
    try {
      const merged = { ...get().filters, ...query }
      const res = await examService.getAll(merged)
      set({ exams: res.data, pagination: res.meta.pagination, filters: merged, isLoading: false })
    } catch (e) {
      set({ error: errorMessage(e, 'Failed to fetch'), isLoading: false })
    }
  },

  createExam: async (data) => {
    set({ isSubmitting: true, error: null })
    try {
      const e = await examService.create(data)
      await get().fetchExams()
      set({ isSubmitting: false })
      return e
    } catch (e) {
      set({ error: errorMessage(e, 'Failed to create'), isSubmitting: false })
      return null
    }
  },

  updateExam: async (id, data) => {
    set({ isSubmitting: true, error: null })
    try {
      const e = await examService.update(id, data)
      await get().fetchExams()
      set({ isSubmitting: false })
      return e
    } catch (e) {
      set({ error: errorMessage(e, 'Failed to update'), isSubmitting: false })
      return null
    }
  },

  deleteExam: async (id) => {
    set({ isSubmitting: true, error: null })
    try {
      await examService.delete(id)
      await get().fetchExams()
      set({ isSubmitting: false })
      return true
    } catch (e) {
      set({ error: errorMessage(e, 'Failed to delete'), isSubmitting: false })
      return false
    }
  },

  publishExam: async (id) => {
    set({ isSubmitting: true, error: null })
    try {
      const e = await examService.publish(id)
      await get().fetchExams()
      set({ isSubmitting: false })
      return e
    } catch (e) {
      set({ error: errorMessage(e, 'Failed to publish'), isSubmitting: false })
      return null
    }
  },

  cancelExam: async (id) => {
    set({ isSubmitting: true, error: null })
    try {
      const e = await examService.cancel(id)
      await get().fetchExams()
      set({ isSubmitting: false })
      return e
    } catch (e) {
      set({ error: errorMessage(e, 'Failed to cancel'), isSubmitting: false })
      return null
    }
  },

  setFilters: (f) => {
    set(s => ({ filters: { ...s.filters, ...f, page: 1 } }))
    get().fetchExams({ ...get().filters, ...f, page: 1 })
  },

  setPage: (page) => {
    set(s => ({ filters: { ...s.filters, page } }))
    get().fetchExams({ ...get().filters, page })
  }
}))
