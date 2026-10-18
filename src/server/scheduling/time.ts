// Calendar and time-slot helpers. Pure functions (no database access).

/** A paper's sitting: calendar date plus "HH:mm" start/end times. */
export interface TimeSlot {
  examDate: string
  startTime: string
  endTime: string
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** True when two sittings are on the same date and their time windows overlap. */
export function slotsOverlap(a: TimeSlot, b: TimeSlot): boolean {
  if (a.examDate !== b.examDate) return false
  return toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime)
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

/** Today's calendar date (YYYY-MM-DD) in the given IANA timezone; falls back to UTC. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  const tz = isValidTimeZone(timeZone) ? timeZone : 'UTC'
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export type CalendarExamStatus = 'SCHEDULED' | 'ONGOING' | 'COMPLETED'

/** Status of a published exam derived from its dates (dates are YYYY-MM-DD strings). */
export function examStatusForDates(startDate: string, endDate: string, today: string): CalendarExamStatus {
  if (today < startDate) return 'SCHEDULED'
  if (today > endDate) return 'COMPLETED'
  return 'ONGOING'
}

/** "Morning (09:30 - 12:30)" style label for a sitting. */
export function slotLabel(startTime: string, endTime: string): string {
  return `${toMinutes(startTime) < 12 * 60 ? 'Morning' : 'Afternoon'} (${startTime} - ${endTime})`
}
