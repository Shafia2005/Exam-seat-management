import { describe, expect, it } from '@jest/globals'
import { examStatusForDates, isValidTimeZone, slotLabel, slotsOverlap, todayInTimeZone, toMinutes } from '@/server/scheduling/time'

describe('time slots', () => {
  const morning = { examDate: '2026-10-15', startTime: '09:30', endTime: '12:30' }

  it('converts HH:mm to minutes', () => {
    expect(toMinutes('00:00')).toBe(0)
    expect(toMinutes('09:30')).toBe(570)
    expect(toMinutes('23:59')).toBe(1439)
  })

  it('detects overlapping sittings on the same day', () => {
    expect(slotsOverlap(morning, { examDate: '2026-10-15', startTime: '11:00', endTime: '13:00' })).toBe(true)
    expect(slotsOverlap(morning, { examDate: '2026-10-15', startTime: '08:00', endTime: '10:00' })).toBe(true)
  })

  it('treats back-to-back and other-day sittings as free', () => {
    expect(slotsOverlap(morning, { examDate: '2026-10-15', startTime: '12:30', endTime: '15:00' })).toBe(false)
    expect(slotsOverlap(morning, { examDate: '2026-10-16', startTime: '09:30', endTime: '12:30' })).toBe(false)
  })

  it('labels morning and afternoon sittings', () => {
    expect(slotLabel('09:30', '12:30')).toBe('Morning (09:30 - 12:30)')
    expect(slotLabel('14:00', '17:00')).toBe('Afternoon (14:00 - 17:00)')
  })
})

describe('calendar status', () => {
  it('follows the exam dates', () => {
    expect(examStatusForDates('2026-10-15', '2026-10-28', '2026-10-14')).toBe('SCHEDULED')
    expect(examStatusForDates('2026-10-15', '2026-10-28', '2026-10-15')).toBe('ONGOING')
    expect(examStatusForDates('2026-10-15', '2026-10-28', '2026-10-28')).toBe('ONGOING')
    expect(examStatusForDates('2026-10-15', '2026-10-28', '2026-10-29')).toBe('COMPLETED')
  })

  it('computes "today" in the institution timezone', () => {
    // 20:00 UTC on 17 Oct is already 18 Oct in India and still 17 Oct in New York.
    const now = new Date('2026-10-17T20:00:00Z')
    expect(todayInTimeZone('Asia/Kolkata', now)).toBe('2026-10-18')
    expect(todayInTimeZone('America/New_York', now)).toBe('2026-10-17')
  })

  it('validates timezones and falls back to UTC', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true)
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
    expect(todayInTimeZone('Mars/Olympus', new Date('2026-10-17T23:30:00Z'))).toBe('2026-10-17')
  })
})
