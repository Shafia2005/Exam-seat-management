import { create } from 'zustand'
import { errorMessage } from '@/lib/api-client'
import type { AllocationSummary } from '@/types/seat.types'
import { SeatAllocation, CreateAllocationRequest, AllocationResult, Block, Room, Bench } from './seats.types'
import { seatService } from './seats.service'

interface SeatsState {
  /** Seating plans (one per paper) for `examId`. */
  allocations: SeatAllocation[]
  examId: string
  summary: AllocationSummary | null
  blocks: Block[]
  rooms: Room[]
  benches: Bench[]
  isLoading: boolean
  isSubmitting: boolean
  error: string | null
  fetchAllocations: (examId: string) => Promise<void>
  fetchSummary: () => Promise<void>
  allocateSeats: (data: CreateAllocationRequest) => Promise<AllocationResult | null>
  clearAllocation: (examId: string, sessionId?: string) => Promise<void>
  initializeData: () => Promise<void>
}

export const useSeatsStore = create<SeatsState>((set, get) => ({
  allocations: [],
  examId: '',
  summary: null,
  blocks: [],
  rooms: [],
  benches: [],
  isLoading: false,
  isSubmitting: false,
  error: null,

  fetchAllocations: async (examId) => {
    set({ isLoading: true, error: null, examId })
    if (!examId) return set({ allocations: [], isLoading: false })
    try {
      const allocations = await seatService.getAllocations({ examId })
      // Ignore a slow response for an exam that is no longer selected.
      if (get().examId === examId) set({ allocations, isLoading: false })
    } catch (e) {
      set({ error: errorMessage(e, 'Failed to load seating'), isLoading: false })
    }
  },

  fetchSummary: async () => {
    try {
      set({ summary: await seatService.getSummary() })
    } catch (e) {
      set({ error: errorMessage(e, 'Failed to load seating summary') })
    }
  },

  allocateSeats: async (data) => {
    set({ isSubmitting: true, error: null })
    try {
      const result = await seatService.allocateSeats(data)
      await Promise.all([get().fetchAllocations(data.examId), get().fetchSummary()])
      set({ isSubmitting: false })
      return result
    } catch (e) {
      set({ error: errorMessage(e, 'Failed to allocate'), isSubmitting: false })
      return null
    }
  },

  clearAllocation: async (examId, sessionId) => {
    set({ isSubmitting: true, error: null })
    try {
      await seatService.clearAllocation(examId, sessionId)
      await Promise.all([get().fetchAllocations(examId), get().fetchSummary()])
      set({ isSubmitting: false })
    } catch (e) {
      set({ error: errorMessage(e, 'Failed to clear'), isSubmitting: false })
    }
  },

  initializeData: async () => {
    try {
      const [blocks, rooms, benches, summary] = await Promise.all([
        seatService.getBlocks(),
        seatService.getRooms(),
        seatService.getBenches(),
        seatService.getSummary(),
      ])
      set({ blocks, rooms, benches, summary })
    } catch (e) {
      set({ error: errorMessage(e, 'Failed to initialize data') })
    }
  },
}))
