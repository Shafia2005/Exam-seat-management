import { describe, expect, it } from '@jest/globals'
import {
  applyAlternateSpacing,
  assignSeats,
  capSeatsPerRoom,
  countAdjacentSameDepartment,
  rowLetter,
  seatLabel,
  type SeatSlot,
  type SeatStudent,
} from '@/server/allocation/seat-algorithms'

function grid(roomId: string, rows: number, cols: number): SeatSlot[] {
  const seats: SeatSlot[] = []
  for (let row = 1; row <= rows; row++) {
    for (let column = 1; column <= cols; column++) {
      seats.push({ benchId: `${roomId}-${row}-${column}`, roomId, roomName: roomId, row, column, seatPosition: 1, seatsPerBench: 1 })
    }
  }
  return seats
}

const students: SeatStudent[] = Array.from({ length: 24 }, (_, i) => ({
  id: `s${i}`,
  rollNumber: `R${String(i).padStart(3, '0')}`,
  departmentId: ['cs', 'ec', 'me'][i % 3],
}))

describe('assignSeats', () => {
  const seats = grid('A', 4, 6)

  it('seats everyone once when there is room', () => {
    for (const algorithm of ['sequential', 'random', 'department_wise', 'anti_cheating'] as const) {
      const result = assignSeats(algorithm, students, seats)
      expect(result).toHaveLength(students.length)
      expect(new Set(result.map((r) => r.student.id)).size).toBe(students.length)
      expect(new Set(result.map((r) => r.seat.benchId)).size).toBe(students.length)
    }
  })

  it('leaves out students beyond capacity', () => {
    expect(assignSeats('sequential', students, seats.slice(0, 10))).toHaveLength(10)
  })

  it('seats in roll-number order for sequential', () => {
    const result = assignSeats('sequential', [...students].reverse(), seats)
    expect(result[0].student.rollNumber).toBe('R000')
    expect(result[0].seat.row).toBe(1)
    expect(result[0].seat.column).toBe(1)
  })

  it('anti-cheating keeps same-department neighbours to a minimum', () => {
    const sequential = countAdjacentSameDepartment(assignSeats('sequential', students, seats))
    const antiCheating = countAdjacentSameDepartment(assignSeats('anti_cheating', students, seats))
    expect(antiCheating).toBe(0)
    expect(antiCheating).toBeLessThanOrEqual(sequential)
  })
})

describe('seat helpers', () => {
  it('spaces candidates in a checkerboard', () => {
    const spaced = applyAlternateSpacing(grid('A', 2, 2))
    expect(spaced.map((s) => `${s.row}${s.column}`)).toEqual(['11', '22'])
  })

  it('caps seats per room', () => {
    const capped = capSeatsPerRoom([...grid('A', 3, 3), ...grid('B', 3, 3)], 4)
    expect(capped.filter((s) => s.roomId === 'A')).toHaveLength(4)
    expect(capped.filter((s) => s.roomId === 'B')).toHaveLength(4)
  })

  it('labels seats', () => {
    expect(rowLetter(1)).toBe('A')
    expect(rowLetter(27)).toBe('AA')
    expect(seatLabel({ row: 2, column: 5, seatPosition: 1, seatsPerBench: 1 })).toBe('B5')
    expect(seatLabel({ row: 2, column: 5, seatPosition: 2, seatsPerBench: 2 })).toBe('B5-2')
  })
})
