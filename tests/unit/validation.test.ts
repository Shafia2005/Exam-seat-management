import { describe, expect, it } from '@jest/globals'
import {
  allocateSeatsSchema,
  examSessionUpdateSchema,
  markAttendanceSchema,
  organizationUpdateSchema,
  studentListQuery,
} from '@/server/validation'
import { toE164 } from '@/server/notify'

describe('request validation', () => {
  it('needs students or a selection to allocate seats', () => {
    expect(allocateSeatsSchema.safeParse({ examId: 'e1', algorithm: 'random' }).success).toBe(false)
    expect(allocateSeatsSchema.safeParse({ examId: 'e1', selection: {} }).success).toBe(true)
    expect(allocateSeatsSchema.safeParse({ examId: 'e1', studentIds: ['s1'] }).success).toBe(true)
  })

  it('parses comma-separated list filters', () => {
    const q = studentListQuery.parse({ departmentIds: 'd1, d2', semesters: '3,5' })
    expect(q.departmentIds).toEqual(['d1', 'd2'])
    expect(q.semesters).toEqual([3, 5])
    expect(studentListQuery.safeParse({ semesters: '3,13' }).success).toBe(false)
  })

  it('accepts present, absent or a cleared mark', () => {
    const base = { sessionId: 's', roomId: 'r' }
    expect(markAttendanceSchema.safeParse({ ...base, marks: [{ allocationId: 'a', status: 'present' }] }).success).toBe(true)
    expect(markAttendanceSchema.safeParse({ ...base, marks: [{ allocationId: 'a', status: null }] }).success).toBe(true)
    expect(markAttendanceSchema.safeParse({ ...base, marks: [{ allocationId: 'a', status: 'late' }] }).success).toBe(false)
    expect(markAttendanceSchema.safeParse({ ...base, marks: [] }).success).toBe(false)
  })

  it('checks paper times when both are sent', () => {
    expect(examSessionUpdateSchema.safeParse({ startTime: '12:00', endTime: '11:00' }).success).toBe(false)
    expect(examSessionUpdateSchema.safeParse({ startTime: '12:00' }).success).toBe(true)
  })

  it('validates the institution policy', () => {
    expect(organizationUpdateSchema.safeParse({ minAttendancePercent: 101 }).success).toBe(false)
    expect(organizationUpdateSchema.safeParse({ minAttendancePercent: '80' }).success).toBe(true)
    expect(organizationUpdateSchema.safeParse({ timezone: 'Asia/Kolkata' }).success).toBe(true)
    expect(organizationUpdateSchema.safeParse({ timezone: 'Nowhere/Land' }).success).toBe(false)
  })
})

describe('toE164', () => {
  it('normalises phone numbers for SMS', () => {
    expect(toE164('+91 98765 43210')).toBe('+919876543210')
    expect(toE164('098765 43210')).toBe('+919876543210')
    expect(toE164('12')).toBeNull()
    expect(toE164(undefined)).toBeNull()
  })
})
