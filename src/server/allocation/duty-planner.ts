// Invigilation duty planning for one paper. Pure function (no database access),
// shared by the API and unit tests.

export type DutyStrategy = 'fair_distribution' | 'inter_departmental' | 'seniority_based'

export interface PlannerTeacher {
  id: string
  departmentName: string
  designation: string
  /** Maximum duties per calendar day. */
  maxDuties: number
}

export interface PlannerRoom {
  id: string
  studentCount: number
  /** Department with the most students seated in the room. */
  primaryDept?: string
}

export interface PlannerOptions {
  strategy: DutyStrategy
  invigilatorsPerRoom: number
  invigilatorRatio?: 'fixed' | 'ratio_25' | 'ratio_30'
  /** Overrides every teacher's daily limit. */
  maxDutiesOverride?: number
}

export interface PlannedDuty {
  roomId: string
  teacherId: string
  role: 'CHIEF_INVIGILATOR' | 'INVIGILATOR'
}

export interface PlanResult {
  duties: PlannedDuty[]
  /** Rooms that could not be fully staffed without breaking a daily limit or time conflict. */
  shortfalls: { roomId: string; missing: number }[]
}

export function invigilatorsNeeded(room: PlannerRoom, options: PlannerOptions): number {
  if (options.invigilatorRatio === 'ratio_25') return Math.max(1, Math.ceil(room.studentCount / 25))
  if (options.invigilatorRatio === 'ratio_30') return Math.max(1, Math.ceil(room.studentCount / 30))
  return Math.max(1, options.invigilatorsPerRoom)
}

const isAssistant = (t: PlannerTeacher) => t.designation.toLowerCase().includes('assistant')
const isSenior = (t: PlannerTeacher) => t.designation.toLowerCase().includes('professor') && !isAssistant(t)

/**
 * Assigns invigilators to rooms for a single paper.
 *
 * @param load     Duties each teacher already has on the paper's date (across all
 *                 exams). Updated in place as duties are planned, so it can be reused
 *                 for further papers on the same day.
 * @param blocked  Teachers who cannot take this paper (e.g. invigilating another paper
 *                 at an overlapping time).
 */
export function planDuties(
  rooms: PlannerRoom[],
  teachers: PlannerTeacher[],
  options: PlannerOptions,
  load: Map<string, number>,
  blocked: Set<string> = new Set()
): PlanResult {
  const duties: PlannedDuty[] = []
  const shortfalls: PlanResult['shortfalls'] = []
  const limitFor = (t: PlannerTeacher) => options.maxDutiesOverride || t.maxDuties || 2
  const byLowestLoad = (a: PlannerTeacher, b: PlannerTeacher) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0)

  for (const room of rooms) {
    const needed = invigilatorsNeeded(room, options)
    const inRoom = new Set<string>()

    for (let slot = 0; slot < needed; slot++) {
      const candidates = teachers.filter(
        (t) => !blocked.has(t.id) && !inRoom.has(t.id) && (load.get(t.id) ?? 0) < limitFor(t)
      )
      if (candidates.length === 0) {
        shortfalls.push({ roomId: room.id, missing: needed - slot })
        break
      }

      let pool = candidates
      if (options.strategy === 'inter_departmental' && room.primaryDept) {
        const dept = room.primaryDept.toLowerCase()
        const otherDept = candidates.filter((t) => t.departmentName.toLowerCase() !== dept)
        if (otherDept.length) pool = otherDept
      } else if (options.strategy === 'seniority_based') {
        const preferred = slot === 0 ? candidates.filter(isSenior) : candidates.filter(isAssistant)
        if (preferred.length) pool = preferred
      }

      const chosen = [...pool].sort(byLowestLoad)[0]
      inRoom.add(chosen.id)
      load.set(chosen.id, (load.get(chosen.id) ?? 0) + 1)
      duties.push({ roomId: room.id, teacherId: chosen.id, role: slot === 0 ? 'CHIEF_INVIGILATOR' : 'INVIGILATOR' })
    }
  }

  return { duties, shortfalls }
}
