import type { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { Course, Department } from '@/types/catalog.types'
import type { Bench, Block, Room } from '@/types/seat.types'
import { audit } from '../audit'
import { badRequest, conflict, notFound } from '../http'
import {
  benchInclude,
  blockInclude,
  courseInclude,
  departmentInclude,
  roomInclude,
  toBenchDto,
  toBlockDto,
  toCourseDto,
  toDepartmentDto,
  toRoomDto,
} from '../mappers'
import type { AuthContext } from '../session'
import type {
  benchListQuery,
  blockCreateSchema,
  blockListQuery,
  blockUpdateSchema,
  courseCreateSchema,
  courseListQuery,
  courseUpdateSchema,
  departmentCreateSchema,
  departmentUpdateSchema,
  roomCreateSchema,
  roomListQuery,
  roomUpdateSchema,
} from '../validation'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// ─── Departments ────────────────────────────────────────────────────────────

export async function listDepartments(ctx: AuthContext): Promise<Department[]> {
  const rows = await prisma.department.findMany({
    where: { organizationId: ctx.organizationId },
    include: departmentInclude,
    orderBy: { name: 'asc' },
  })
  return rows.map(toDepartmentDto)
}

export async function createDepartment(ctx: AuthContext, input: z.infer<typeof departmentCreateSchema>): Promise<Department> {
  const row = await prisma.department.create({
    data: { ...input, organizationId: ctx.organizationId },
    include: departmentInclude,
  })
  await audit(ctx, { action: 'department.created', entityType: 'department', entityId: row.id, summary: `Added department ${row.name} (${row.code})` })
  return toDepartmentDto(row)
}

async function findDepartment(ctx: AuthContext, id: string) {
  const department = await prisma.department.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: departmentInclude,
  })
  if (!department) throw notFound('Department not found')
  return department
}

export async function updateDepartment(
  ctx: AuthContext,
  id: string,
  input: z.infer<typeof departmentUpdateSchema>
): Promise<Department> {
  await findDepartment(ctx, id)
  const row = await prisma.department.update({ where: { id }, data: input, include: departmentInclude })
  await audit(ctx, { action: 'department.updated', entityType: 'department', entityId: id, summary: `Updated department ${row.name} (${row.code})` })
  return toDepartmentDto(row)
}

export async function deleteDepartment(ctx: AuthContext, id: string): Promise<void> {
  const { _count, name } = await findDepartment(ctx, id)
  if (_count.students || _count.teachers || _count.courses) {
    throw conflict(
      `This department still has ${plural(_count.students, 'student')}, ${plural(_count.teachers, 'teacher')} and ${plural(_count.courses, 'course')}. Move or remove them first.`,
      'IN_USE'
    )
  }
  await prisma.department.delete({ where: { id } })
  await audit(ctx, { action: 'department.deleted', entityType: 'department', entityId: id, summary: `Deleted department ${name}` })
}

// ─── Courses ────────────────────────────────────────────────────────────────

export async function listCourses(ctx: AuthContext, q: z.infer<typeof courseListQuery>): Promise<Course[]> {
  const rows = await prisma.course.findMany({
    where: { organizationId: ctx.organizationId, departmentId: q.departmentId },
    include: courseInclude,
    orderBy: { name: 'asc' },
  })
  return rows.map(toCourseDto)
}

async function assertDepartment(ctx: AuthContext, departmentId: string) {
  const department = await prisma.department.findFirst({
    where: { id: departmentId, organizationId: ctx.organizationId },
    select: { id: true },
  })
  if (!department) throw badRequest('The selected department does not exist')
}

export async function createCourse(ctx: AuthContext, input: z.infer<typeof courseCreateSchema>): Promise<Course> {
  await assertDepartment(ctx, input.departmentId)
  const row = await prisma.course.create({
    data: { ...input, organizationId: ctx.organizationId },
    include: courseInclude,
  })
  await audit(ctx, { action: 'course.created', entityType: 'course', entityId: row.id, summary: `Added course ${row.name} (${row.code})` })
  return toCourseDto(row)
}

async function findCourse(ctx: AuthContext, id: string) {
  const course = await prisma.course.findFirst({ where: { id, organizationId: ctx.organizationId }, include: courseInclude })
  if (!course) throw notFound('Course not found')
  return course
}

export async function updateCourse(ctx: AuthContext, id: string, input: z.infer<typeof courseUpdateSchema>): Promise<Course> {
  const course = await findCourse(ctx, id)
  if (input.departmentId && input.departmentId !== course.departmentId) {
    await assertDepartment(ctx, input.departmentId)
    if (course._count.students) {
      throw conflict(
        `${plural(course._count.students, 'student')} are enrolled in this course; it can't move to another department.`,
        'IN_USE'
      )
    }
  }
  const row = await prisma.course.update({ where: { id }, data: input, include: courseInclude })
  await audit(ctx, { action: 'course.updated', entityType: 'course', entityId: id, summary: `Updated course ${row.name} (${row.code})` })
  return toCourseDto(row)
}

export async function deleteCourse(ctx: AuthContext, id: string): Promise<void> {
  const course = await findCourse(ctx, id)
  if (course._count.students) {
    throw conflict(`${plural(course._count.students, 'student')} are enrolled in this course. Move them first.`, 'IN_USE')
  }
  await prisma.course.delete({ where: { id } })
  await audit(ctx, { action: 'course.deleted', entityType: 'course', entityId: id, summary: `Deleted course ${course.name}` })
}

// ─── Blocks ─────────────────────────────────────────────────────────────────

export async function listBlocks(ctx: AuthContext, q: z.infer<typeof blockListQuery> = {}): Promise<Block[]> {
  const rows = await prisma.block.findMany({
    where: { organizationId: ctx.organizationId, isActive: q.includeInactive ? undefined : true },
    include: blockInclude,
    orderBy: { name: 'asc' },
  })
  return rows.map(toBlockDto)
}

export async function createBlock(ctx: AuthContext, input: z.infer<typeof blockCreateSchema>): Promise<Block> {
  const row = await prisma.block.create({
    data: { ...input, organizationId: ctx.organizationId },
    include: blockInclude,
  })
  await audit(ctx, { action: 'block.created', entityType: 'block', entityId: row.id, summary: `Added block ${row.name}` })
  return toBlockDto(row)
}

async function findBlock(ctx: AuthContext, id: string) {
  const block = await prisma.block.findFirst({ where: { id, organizationId: ctx.organizationId }, include: blockInclude })
  if (!block) throw notFound('Block not found')
  return block
}

export async function updateBlock(ctx: AuthContext, id: string, input: z.infer<typeof blockUpdateSchema>): Promise<Block> {
  await findBlock(ctx, id)
  const row = await prisma.block.update({ where: { id }, data: input, include: blockInclude })
  await audit(ctx, { action: 'block.updated', entityType: 'block', entityId: id, summary: `Updated block ${row.name}` })
  return toBlockDto(row)
}

export async function deleteBlock(ctx: AuthContext, id: string): Promise<void> {
  const block = await findBlock(ctx, id)
  if (block._count.rooms) {
    throw conflict(`This block still has ${plural(block._count.rooms, 'room')}. Delete or move them first.`, 'IN_USE')
  }
  await prisma.block.delete({ where: { id } })
  await audit(ctx, { action: 'block.deleted', entityType: 'block', entityId: id, summary: `Deleted block ${block.name}` })
}

// ─── Rooms & benches ────────────────────────────────────────────────────────

/** Lists rooms by name; only available rooms unless `includeUnavailable` or a block filter is given. */
export async function listRooms(ctx: AuthContext, q: z.infer<typeof roomListQuery>): Promise<Room[]> {
  const rows = await prisma.room.findMany({
    where: {
      organizationId: ctx.organizationId,
      blockId: q.blockId,
      isAvailable: q.blockId || q.includeUnavailable ? undefined : true,
    },
    include: roomInclude,
    orderBy: { name: 'asc' },
  })
  return rows.map(toRoomDto)
}

async function assertBlock(ctx: AuthContext, blockId: string) {
  const block = await prisma.block.findFirst({
    where: { id: blockId, organizationId: ctx.organizationId },
    select: { id: true },
  })
  if (!block) throw badRequest('The selected block does not exist')
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Creates a room and its full grid of benches (numbered like "101-0203" for row 2, column 3). */
export async function createRoom(ctx: AuthContext, input: z.infer<typeof roomCreateSchema>): Promise<Room> {
  await assertBlock(ctx, input.blockId)

  const room = await prisma.$transaction(async (tx) => {
    const created = await tx.room.create({
      data: {
        organizationId: ctx.organizationId,
        blockId: input.blockId,
        name: input.name,
        number: input.number,
        floor: input.floor,
        rows: input.rows,
        columns: input.columns,
        capacity: input.rows * input.columns * input.seatsPerBench,
        isAvailable: input.isAvailable ?? true,
      },
    })
    const benches = []
    for (let row = 1; row <= input.rows; row++) {
      for (let column = 1; column <= input.columns; column++) {
        benches.push({
          organizationId: ctx.organizationId,
          roomId: created.id,
          number: `${input.number}-${pad2(row)}${pad2(column)}`,
          row,
          column,
          seatsPerBench: input.seatsPerBench,
        })
      }
    }
    await tx.bench.createMany({ data: benches })
    return tx.room.findUniqueOrThrow({ where: { id: created.id }, include: roomInclude })
  })
  await audit(ctx, {
    action: 'room.created',
    entityType: 'room',
    entityId: room.id,
    summary: `Added room ${room.name} (${input.rows}×${input.columns}, ${room.capacity} seats)`,
  })
  return toRoomDto(room)
}

async function findRoom(ctx: AuthContext, id: string) {
  const room = await prisma.room.findFirst({ where: { id, organizationId: ctx.organizationId }, select: { id: true, name: true } })
  if (!room) throw notFound('Room not found')
  return room
}

export async function updateRoom(ctx: AuthContext, id: string, input: z.infer<typeof roomUpdateSchema>): Promise<Room> {
  await findRoom(ctx, id)
  if (input.blockId) await assertBlock(ctx, input.blockId)
  const row = await prisma.room.update({ where: { id }, data: input, include: roomInclude })
  const availability = input.isAvailable === undefined ? '' : input.isAvailable ? ' (available)' : ' (marked unavailable)'
  await audit(ctx, { action: 'room.updated', entityType: 'room', entityId: id, summary: `Updated room ${row.name}${availability}` })
  return toRoomDto(row)
}

/** Refuses while any exam has seats or duties in the room, since those would be deleted with it. */
export async function deleteRoom(ctx: AuthContext, id: string): Promise<void> {
  const room = await findRoom(ctx, id)
  const [seats, duties] = await Promise.all([
    prisma.seatAllocation.count({ where: { roomId: id } }),
    prisma.invigilationDuty.count({ where: { roomId: id } }),
  ])
  if (seats || duties) {
    throw conflict(
      `This room is used by exam allocations (${plural(seats, 'seat')}, ${duties} ${duties === 1 ? 'duty' : 'duties'}). Clear them, or mark the room unavailable instead.`,
      'IN_USE'
    )
  }
  await prisma.room.delete({ where: { id } })
  await audit(ctx, { action: 'room.deleted', entityType: 'room', entityId: id, summary: `Deleted room ${room.name}` })
}

export async function listBenches(ctx: AuthContext, q: z.infer<typeof benchListQuery>): Promise<Bench[]> {
  const rows = await prisma.bench.findMany({
    where: { organizationId: ctx.organizationId, roomId: q.roomId, isActive: true },
    include: benchInclude,
    orderBy: [{ room: { name: 'asc' } }, { row: 'asc' }, { column: 'asc' }],
  })
  return rows.map(toBenchDto)
}
