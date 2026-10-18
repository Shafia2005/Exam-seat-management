// Seat allocation algorithms. Pure functions with no framework or database
// imports, so the API and the database seed share exactly the same logic.

export type SeatAlgorithm = 'sequential' | 'random' | 'department_wise' | 'anti_cheating'

export interface SeatSlot {
  benchId: string
  roomId: string
  roomName: string
  row: number
  column: number
  seatPosition: number
  seatsPerBench: number
}

export interface SeatStudent {
  id: string
  rollNumber: string
  departmentId: string
}

export interface SeatAssignment<S extends SeatStudent = SeatStudent> {
  student: S
  seat: SeatSlot
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

const positionKey = (roomId: string, row: number, column: number) => `${roomId}:${row}:${column}`

/** Room by name, then row-major within the room, then seat position on the bench. */
export function orderSeats(seats: SeatSlot[]): SeatSlot[] {
  return [...seats].sort(
    (a, b) =>
      collator.compare(a.roomName, b.roomName) ||
      a.roomId.localeCompare(b.roomId) ||
      a.row - b.row ||
      a.column - b.column ||
      a.seatPosition - b.seatPosition
  )
}

function byRollNumber<S extends SeatStudent>(students: S[]): S[] {
  return [...students].sort((a, b) => collator.compare(a.rollNumber, b.rollNumber))
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

/** Round-robin across departments, largest department first, so neighbours tend to differ. */
export function interleaveByDepartment<S extends SeatStudent>(students: S[]): S[] {
  const groups = new Map<string, S[]>()
  students.forEach((s) => {
    const list = groups.get(s.departmentId)
    if (list) list.push(s)
    else groups.set(s.departmentId, [s])
  })

  const queues = Array.from(groups.values()).sort((a, b) => b.length - a.length)
  const longest = queues.length ? queues[0].length : 0
  const result: S[] = []
  for (let i = 0; i < longest; i++) {
    for (const queue of queues) {
      if (i < queue.length) result.push(queue[i])
    }
  }
  return result
}

/** For each seat, the indices of seats on the same bench or an orthogonally adjacent bench. */
function buildNeighbours(seats: SeatSlot[]): number[][] {
  const byPosition = new Map<string, number[]>()
  seats.forEach((s, i) => {
    const key = positionKey(s.roomId, s.row, s.column)
    const list = byPosition.get(key)
    if (list) list.push(i)
    else byPosition.set(key, [i])
  })

  const offsets: [number, number][] = [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]]
  return seats.map((s, i) => {
    const out: number[] = []
    for (const [dr, dc] of offsets) {
      const list = byPosition.get(positionKey(s.roomId, s.row + dr, s.column + dc))
      list?.forEach((j) => {
        if (j !== i) out.push(j)
      })
    }
    return out
  })
}

/**
 * Greedy placement: each student takes the free seat with the best score.
 * Same-department neighbours cost 50, different-department neighbours earn 5,
 * and each student already in the room costs 2 so rooms fill evenly.
 */
function allocateAntiCheating<S extends SeatStudent>(students: S[], seats: SeatSlot[]): SeatAssignment<S>[] {
  const ordered = interleaveByDepartment(byRollNumber(students))
  const free = orderSeats(seats)
  const neighbours = buildNeighbours(free)
  const occupant: (S | null)[] = free.map(() => null)
  const roomLoad = new Map<string, number>()
  const result: SeatAssignment<S>[] = []

  for (const student of ordered) {
    let best = -1
    let bestScore = -Infinity

    for (let i = 0; i < free.length; i++) {
      if (occupant[i]) continue
      let score = 100
      for (const j of neighbours[i]) {
        const other = occupant[j]
        if (other) score += other.departmentId === student.departmentId ? -50 : 5
      }
      score -= (roomLoad.get(free[i].roomId) ?? 0) * 2
      if (score > bestScore) {
        bestScore = score
        best = i
      }
    }

    if (best === -1) break
    occupant[best] = student
    roomLoad.set(free[best].roomId, (roomLoad.get(free[best].roomId) ?? 0) + 1)
    result.push({ student, seat: free[best] })
  }

  return result
}

/** Assigns students to seats. Students beyond the number of seats are left out. */
export function assignSeats<S extends SeatStudent>(
  algorithm: SeatAlgorithm,
  students: S[],
  seats: SeatSlot[],
  random: () => number = Math.random
): SeatAssignment<S>[] {
  const pair = (list: S[], slots: SeatSlot[]) =>
    list.slice(0, slots.length).map((student, i) => ({ student, seat: slots[i] }))

  switch (algorithm) {
    case 'random':
      return pair(shuffle(students, random), shuffle(seats, random))
    case 'department_wise':
      return pair(interleaveByDepartment(byRollNumber(students)), orderSeats(seats))
    case 'anti_cheating':
      return allocateAntiCheating(students, seats)
    case 'sequential':
    default:
      return pair(byRollNumber(students), orderSeats(seats))
  }
}

/** Keeps every other seat in a checkerboard pattern, leaving a gap between candidates. */
export function applyAlternateSpacing(seats: SeatSlot[]): SeatSlot[] {
  return seats.filter((s) => (s.row + s.column) % 2 === 0)
}

/** Keeps at most `max` seats per room, in seating order. */
export function capSeatsPerRoom(seats: SeatSlot[], max: number): SeatSlot[] {
  const counts = new Map<string, number>()
  return orderSeats(seats).filter((s) => {
    const current = counts.get(s.roomId) ?? 0
    if (current >= max) return false
    counts.set(s.roomId, current + 1)
    return true
  })
}

/** Number of neighbouring seat pairs (same bench, or side/front/back) held by the same department. */
export function countAdjacentSameDepartment(assignments: SeatAssignment[]): number {
  const byPosition = new Map<string, SeatAssignment[]>()
  assignments.forEach((a) => {
    const key = positionKey(a.seat.roomId, a.seat.row, a.seat.column)
    const list = byPosition.get(key)
    if (list) list.push(a)
    else byPosition.set(key, [a])
  })

  let count = 0
  assignments.forEach((a) => {
    const { roomId, row, column, seatPosition } = a.seat
    const dept = a.student.departmentId
    // Look only "forward" (later seat on the bench, right, behind) so each pair counts once.
    const sameBench = byPosition.get(positionKey(roomId, row, column)) ?? []
    const right = byPosition.get(positionKey(roomId, row, column + 1)) ?? []
    const behind = byPosition.get(positionKey(roomId, row + 1, column)) ?? []
    sameBench.forEach((b) => {
      if (b.seat.seatPosition > seatPosition && b.student.departmentId === dept) count++
    })
    right.concat(behind).forEach((b) => {
      if (b.student.departmentId === dept) count++
    })
  })
  return count
}

/** 1 → "A", 26 → "Z", 27 → "AA". */
export function rowLetter(row: number): string {
  let n = row
  let out = ''
  while (n > 0) {
    out = String.fromCharCode(65 + ((n - 1) % 26)) + out
    n = Math.floor((n - 1) / 26)
  }
  return out || String(row)
}

/** Seat label such as "B5" (row B, column 5), or "B5-2" for the second seat on a shared bench. */
export function seatLabel(seat: Pick<SeatSlot, 'row' | 'column' | 'seatPosition' | 'seatsPerBench'>): string {
  const base = `${rowLetter(seat.row)}${seat.column}`
  return seat.seatsPerBench > 1 ? `${base}-${seat.seatPosition}` : base
}
