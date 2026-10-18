import {
  SeatAllocation,
  CreateAllocationRequest,
  AllocationResult,
  Allocation,
  Block,
  Room,
  Bench,
} from './seats.types'
import type { AllocationSummary, MySeatResponse } from '@/types/seat.types'
import type { NotificationChannel, NotifyResult } from '@/types/admin.types'
import { api } from '@/lib/api-client'

export interface BlockInput {
  name: string
  code: string
  buildingName?: string
  floor?: number
  capacity?: number
  isActive?: boolean
}

export interface RoomInput {
  blockId: string
  name: string
  number: string
  floor?: number | null
  rows: number
  columns: number
  seatsPerBench?: number
  isAvailable?: boolean
}

// Allocation algorithms run on the server (src/server/allocation); results are persisted per paper.
class SeatService {
  async getBlocks(includeInactive = false): Promise<Block[]> {
    const { data } = await api.get<Block[]>('/blocks', { includeInactive: includeInactive || undefined })
    return data
  }

  async createBlock(input: BlockInput): Promise<Block> {
    const { data } = await api.post<Block>('/blocks', input)
    return data
  }

  async updateBlock(id: string, input: Partial<BlockInput>): Promise<Block> {
    const { data } = await api.patch<Block>(`/blocks/${encodeURIComponent(id)}`, input)
    return data
  }

  async deleteBlock(id: string): Promise<void> {
    await api.delete(`/blocks/${encodeURIComponent(id)}`)
  }

  /** Available rooms; `includeUnavailable` also returns rooms taken out of service. */
  async getRooms(blockId?: string, includeUnavailable = false): Promise<Room[]> {
    const { data } = await api.get<Room[]>('/rooms', { blockId, includeUnavailable: includeUnavailable || undefined })
    return data
  }

  /** Creates the room and generates its bench grid. */
  async createRoom(input: RoomInput): Promise<Room> {
    const { data } = await api.post<Room>('/rooms', input)
    return data
  }

  async updateRoom(id: string, input: Partial<Omit<RoomInput, 'rows' | 'columns' | 'seatsPerBench'>>): Promise<Room> {
    const { data } = await api.patch<Room>(`/rooms/${encodeURIComponent(id)}`, input)
    return data
  }

  async deleteRoom(id: string): Promise<void> {
    await api.delete(`/rooms/${encodeURIComponent(id)}`)
  }

  async getBenches(roomId?: string): Promise<Bench[]> {
    const { data } = await api.get<Bench[]>('/benches', { roomId })
    return data
  }

  /** Seating plans, one per paper. */
  async getAllocations(query: { examId?: string; sessionId?: string } = {}): Promise<SeatAllocation[]> {
    const { data } = await api.get<SeatAllocation[]>('/seats/allocation', query)
    return data
  }

  /** Seat counts per exam and per paper/room. */
  async getSummary(): Promise<AllocationSummary> {
    const { data } = await api.get<AllocationSummary>('/seats/summary')
    return data
  }

  async allocateSeats(request: CreateAllocationRequest): Promise<AllocationResult> {
    const { data } = await api.post<AllocationResult>('/seats/allocate', request)
    return data
  }

  /** Clears every paper of the exam, or only `sessionId`. */
  async clearAllocation(examId: string, sessionId?: string): Promise<void> {
    await api.delete('/seats/allocation', { examId, sessionId })
  }

  /** Emails/texts every seated student their seats. */
  async notifyStudents(examId: string, channels: NotificationChannel[]): Promise<NotifyResult> {
    const { data } = await api.post<NotifyResult>('/seats/notify', { examId, channels })
    return data
  }

  /** The signed-in student's seats; admins may pass a `studentId` to preview. */
  async getMySeat(studentId?: string): Promise<MySeatResponse> {
    const { data } = await api.get<MySeatResponse>('/seats/my-seat', { studentId })
    return data
  }

  /** URL of the hall-ticket PDF (a plain link, so the browser downloads it with the session cookie). */
  hallTicketUrl(examId: string, studentId?: string): string {
    const params = new URLSearchParams({ examId })
    if (studentId) params.set('studentId', studentId)
    return `/api/seats/hall-ticket?${params.toString()}`
  }

  async exportAllocations(examId?: string): Promise<Allocation[]> {
    const allocations = await this.getAllocations({ examId })
    return allocations.flatMap((a) => a.allocations)
  }
}

export const seatService = new SeatService()
