import { create } from 'zustand'
import { errorMessage } from '@/lib/api-client'
import { Teacher, TeacherQuery, CreateTeacherRequest, UpdateTeacherRequest } from './teachers.types'
import { teacherService } from './teachers.service'

interface TeachersState {
  teachers: Teacher[]
  selectedTeacher: Teacher | null
  pagination: { page: number; limit: number; total: number; totalPages: number }
  isLoading: boolean
  isSubmitting: boolean
  error: string | null
  filters: TeacherQuery
  fetchTeachers: (query?: TeacherQuery) => Promise<void>
  createTeacher: (data: CreateTeacherRequest) => Promise<Teacher | null>
  updateTeacher: (id: string, data: UpdateTeacherRequest) => Promise<Teacher | null>
  deleteTeacher: (id: string) => Promise<boolean>
  setFilters: (filters: Partial<TeacherQuery>) => void
  setPage: (page: number) => void
}

const defaultFilters: TeacherQuery = { page: 1, limit: 10, search: '', status: 'all' }

export const useTeachersStore = create<TeachersState>((set, get) => ({
  teachers: [],
  selectedTeacher: null,
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  isLoading: false,
  isSubmitting: false,
  error: null,
  filters: defaultFilters,

  fetchTeachers: async (query) => {
    set({ isLoading: true, error: null })
    try {
      const merged = { ...get().filters, ...query }
      const res = await teacherService.getAll(merged)
      set({ teachers: res.data, pagination: res.meta.pagination, filters: merged, isLoading: false })
    } catch (e) {
      set({ error: errorMessage(e, 'Failed to fetch'), isLoading: false })
    }
  },

  createTeacher: async (data) => {
    set({ isSubmitting: true, error: null })
    try {
      const t = await teacherService.create(data)
      await get().fetchTeachers()
      set({ isSubmitting: false })
      return t
    } catch (e) {
      set({ error: errorMessage(e, 'Failed to create'), isSubmitting: false })
      return null
    }
  },

  updateTeacher: async (id, data) => {
    set({ isSubmitting: true, error: null })
    try {
      const t = await teacherService.update(id, data)
      await get().fetchTeachers()
      set({ isSubmitting: false })
      return t
    } catch (e) {
      set({ error: errorMessage(e, 'Failed to update'), isSubmitting: false })
      return null
    }
  },

  deleteTeacher: async (id) => {
    set({ isSubmitting: true, error: null })
    try {
      await teacherService.delete(id)
      await get().fetchTeachers()
      set({ isSubmitting: false })
      return true
    } catch (e) {
      set({ error: errorMessage(e, 'Failed to delete'), isSubmitting: false })
      return false
    }
  },

  setFilters: (f) => {
    set(s => ({ filters: { ...s.filters, ...f, page: 1 } }))
    get().fetchTeachers({ ...get().filters, ...f, page: 1 })
  },

  setPage: (page) => {
    set(s => ({ filters: { ...s.filters, page } }))
    get().fetchTeachers({ ...get().filters, page })
  }
}))
