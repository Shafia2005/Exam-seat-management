import { describe, expect, it } from '@jest/globals'
import { invigilatorsNeeded, planDuties, type PlannerRoom, type PlannerTeacher } from '@/server/allocation/duty-planner'

const teachers: PlannerTeacher[] = [
  { id: 't1', departmentName: 'Computer Science', designation: 'Professor', maxDuties: 2 },
  { id: 't2', departmentName: 'Computer Science', designation: 'Assistant Professor', maxDuties: 2 },
  { id: 't3', departmentName: 'Electronics', designation: 'Associate Professor', maxDuties: 1 },
  { id: 't4', departmentName: 'Mechanical', designation: 'Assistant Professor', maxDuties: 2 },
]
const rooms: PlannerRoom[] = [
  { id: 'r1', studentCount: 60, primaryDept: 'Computer Science' },
  { id: 'r2', studentCount: 40, primaryDept: 'Electronics' },
]

describe('invigilatorsNeeded', () => {
  it('uses a fixed count or a students-per-invigilator ratio', () => {
    expect(invigilatorsNeeded(rooms[0], { strategy: 'fair_distribution', invigilatorsPerRoom: 2 })).toBe(2)
    expect(invigilatorsNeeded(rooms[0], { strategy: 'fair_distribution', invigilatorsPerRoom: 1, invigilatorRatio: 'ratio_25' })).toBe(3)
    expect(invigilatorsNeeded({ id: 'x', studentCount: 0 }, { strategy: 'fair_distribution', invigilatorsPerRoom: 1, invigilatorRatio: 'ratio_30' })).toBe(1)
  })
})

describe('planDuties', () => {
  it('staffs every room with a chief invigilator first and no teacher twice in a room', () => {
    const { duties, shortfalls } = planDuties(rooms, teachers, { strategy: 'fair_distribution', invigilatorsPerRoom: 2 }, new Map())
    expect(shortfalls).toEqual([])
    expect(duties).toHaveLength(4)
    for (const roomId of ['r1', 'r2']) {
      const inRoom = duties.filter((d) => d.roomId === roomId)
      expect(inRoom[0].role).toBe('CHIEF_INVIGILATOR')
      expect(new Set(inRoom.map((d) => d.teacherId)).size).toBe(inRoom.length)
    }
  })

  it('never exceeds a daily limit, counting duties already held that day', () => {
    // t1 and t2 already have 2 duties today (from another exam); t3 has 1 of 1.
    const load = new Map([
      ['t1', 2],
      ['t2', 2],
      ['t3', 1],
    ])
    const { duties, shortfalls } = planDuties(rooms, teachers, { strategy: 'fair_distribution', invigilatorsPerRoom: 2 }, load)
    expect(duties.every((d) => d.teacherId === 't4')).toBe(true)
    expect(duties).toHaveLength(2)
    expect(load.get('t4')).toBe(2)
    // The rest is reported rather than over-assigned.
    expect(shortfalls.reduce((n, s) => n + s.missing, 0)).toBe(2)
  })

  it('skips teachers blocked by an overlapping paper', () => {
    const { duties } = planDuties(rooms, teachers, { strategy: 'fair_distribution', invigilatorsPerRoom: 1 }, new Map(), new Set(['t1', 't2']))
    expect(duties.map((d) => d.teacherId).sort()).toEqual(['t3', 't4'])
  })

  it('prefers invigilators from another department (inter-departmental)', () => {
    const { duties } = planDuties([rooms[0]], teachers, { strategy: 'inter_departmental', invigilatorsPerRoom: 2 }, new Map())
    expect(duties.map((d) => d.teacherId)).not.toContain('t1')
    expect(duties.map((d) => d.teacherId)).not.toContain('t2')
  })

  it('puts a senior professor in charge (seniority)', () => {
    const { duties } = planDuties([rooms[0]], teachers, { strategy: 'seniority_based', invigilatorsPerRoom: 2 }, new Map())
    const chief = duties.find((d) => d.role === 'CHIEF_INVIGILATOR')
    expect(['t1', 't3']).toContain(chief?.teacherId)
  })

  it('applies a global limit override', () => {
    const { duties } = planDuties(rooms, [teachers[0]], { strategy: 'fair_distribution', invigilatorsPerRoom: 1, maxDutiesOverride: 1 }, new Map())
    expect(duties).toHaveLength(1)
  })
})
