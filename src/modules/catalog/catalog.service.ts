import type { Course, Department } from '@/types/catalog.types'
import { api } from '@/lib/api-client'

export interface DepartmentInput {
  name: string
  code: string
  description?: string
}

export interface CourseInput {
  name: string
  code: string
  departmentId: string
  durationYears?: number
}

class CatalogService {
  async getDepartments(): Promise<Department[]> {
    const { data } = await api.get<Department[]>('/departments')
    return data
  }

  async createDepartment(input: DepartmentInput): Promise<Department> {
    const { data } = await api.post<Department>('/departments', input)
    return data
  }

  async updateDepartment(id: string, input: Partial<DepartmentInput>): Promise<Department> {
    const { data } = await api.patch<Department>(`/departments/${encodeURIComponent(id)}`, input)
    return data
  }

  async deleteDepartment(id: string): Promise<void> {
    await api.delete(`/departments/${encodeURIComponent(id)}`)
  }

  async getCourses(departmentId?: string): Promise<Course[]> {
    const { data } = await api.get<Course[]>('/courses', { departmentId })
    return data
  }

  async createCourse(input: CourseInput): Promise<Course> {
    const { data } = await api.post<Course>('/courses', input)
    return data
  }

  async updateCourse(id: string, input: Partial<CourseInput>): Promise<Course> {
    const { data } = await api.patch<Course>(`/courses/${encodeURIComponent(id)}`, input)
    return data
  }

  async deleteCourse(id: string): Promise<void> {
    await api.delete(`/courses/${encodeURIComponent(id)}`)
  }
}

export const catalogService = new CatalogService()
