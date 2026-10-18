import { create } from 'zustand'
import { Student, StudentQuery, CreateStudentRequest, UpdateStudentRequest, PaginatedResponse } from './students.types'
import { studentService } from './students.service'

interface StudentsState {
  // Data
  students: Student[]
  selectedStudent: Student | null
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }

  // Loading states
  isLoading: boolean
  isSubmitting: boolean
  error: string | null

  // Filters
  filters: StudentQuery

  // Actions
  fetchStudents: (query?: StudentQuery) => Promise<void>
  getStudentById: (id: string) => Promise<Student | null>
  createStudent: (data: CreateStudentRequest) => Promise<Student | null>
  updateStudent: (id: string, data: UpdateStudentRequest) => Promise<Student | null>
  deleteStudent: (id: string) => Promise<boolean>
  setSelectedStudent: (student: Student | null) => void
  setFilters: (filters: Partial<StudentQuery>) => void
  resetFilters: () => void
  setPage: (page: number) => void
  setLimit: (limit: number) => void
}

const defaultFilters: StudentQuery = {
  page: 1,
  limit: 10,
  search: '',
  status: 'all',
  eligibility: 'all'
}

export const useStudentsStore = create<StudentsState>((set, get) => ({
  // Initial state
  students: [],
  selectedStudent: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  },
  isLoading: false,
  isSubmitting: false,
  error: null,
  filters: defaultFilters,

  // Fetch students with filters
  fetchStudents: async (query?: StudentQuery) => {
    set({ isLoading: true, error: null })
    try {
      const currentFilters = get().filters
      const mergedQuery = { ...currentFilters, ...query }
      
      const response = await studentService.getAll(mergedQuery)
      
      set({
        students: response.data,
        pagination: response.meta.pagination,
        filters: mergedQuery,
        isLoading: false
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch students',
        isLoading: false
      })
    }
  },

  // Get single student
  getStudentById: async (id: string) => {
    try {
      const student = await studentService.getById(id)
      if (student) {
        set({ selectedStudent: student })
      }
      return student
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch student'
      })
      return null
    }
  },

  // Create student
  createStudent: async (data: CreateStudentRequest) => {
    set({ isSubmitting: true, error: null })
    try {
      const student = await studentService.create(data)
      await get().fetchStudents()
      set({ isSubmitting: false })
      return student
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create student',
        isSubmitting: false
      })
      return null
    }
  },

  // Update student
  updateStudent: async (id: string, data: UpdateStudentRequest) => {
    set({ isSubmitting: true, error: null })
    try {
      const student = await studentService.update(id, data)
      await get().fetchStudents()
      set({ 
        selectedStudent: student,
        isSubmitting: false 
      })
      return student
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update student',
        isSubmitting: false
      })
      return null
    }
  },

  // Delete student
  deleteStudent: async (id: string) => {
    set({ isSubmitting: true, error: null })
    try {
      await studentService.delete(id)
      await get().fetchStudents()
      set({ isSubmitting: false })
      return true
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete student',
        isSubmitting: false
      })
      return false
    }
  },

  // Set selected student
  setSelectedStudent: (student: Student | null) => {
    set({ selectedStudent: student })
  },

  // Update filters
  setFilters: (filters: Partial<StudentQuery>) => {
    set(state => ({
      filters: { ...state.filters, ...filters, page: 1 }
    }))
    get().fetchStudents({ ...get().filters, ...filters, page: 1 })
  },

  // Reset filters
  resetFilters: () => {
    set({ filters: defaultFilters })
    get().fetchStudents(defaultFilters)
  },

  // Set page
  setPage: (page: number) => {
    set(state => ({
      filters: { ...state.filters, page }
    }))
    get().fetchStudents({ ...get().filters, page })
  },

  // Set limit
  setLimit: (limit: number) => {
    set(state => ({
      filters: { ...state.filters, limit, page: 1 }
    }))
    get().fetchStudents({ ...get().filters, limit, page: 1 })
  }
}))
