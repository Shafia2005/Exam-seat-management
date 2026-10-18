import { create } from 'zustand'
import type { Course, Department } from '@/types/catalog.types'
import { errorMessage } from '@/lib/api-client'
import { catalogService } from './catalog.service'

interface CatalogState {
  departments: Department[]
  courses: Course[]
  isLoaded: boolean
  error: string | null
  fetchCatalog: () => Promise<void>
}

export const useCatalogStore = create<CatalogState>((set) => ({
  departments: [],
  courses: [],
  isLoaded: false,
  error: null,

  fetchCatalog: async () => {
    try {
      const [departments, courses] = await Promise.all([
        catalogService.getDepartments(),
        catalogService.getCourses()
      ])
      set({ departments, courses, isLoaded: true, error: null })
    } catch (e) {
      set({ error: errorMessage(e, 'Failed to load departments') })
    }
  }
}))
