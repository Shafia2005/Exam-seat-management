import { describe, expect, it } from '@jest/globals'
import {
  STUDENT_IMPORT_COLUMNS,
  TEACHER_IMPORT_COLUMNS,
  canonicalizeRow,
  mapSheet,
  parseCsv,
  templateCsv,
} from '@/lib/import-columns'
import { importSchema, studentImportRowSchema, teacherImportRowSchema } from '@/server/validation'

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, CRLF and a BOM', () => {
    const text = '﻿Name,Note\r\n"Rao, Asha","said ""hi"""\r\nKumar,plain\r\n'
    expect(parseCsv(text)).toEqual([
      ['Name', 'Note'],
      ['Rao, Asha', 'said "hi"'],
      ['Kumar', 'plain'],
    ])
  })

  it('detects semicolon-separated files', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('keeps newlines inside quoted fields', () => {
    expect(parseCsv('a,b\n"line 1\nline 2",x')).toEqual([
      ['a', 'b'],
      ['line 1\nline 2', 'x'],
    ])
  })
})

describe('column mapping', () => {
  it('matches headers by label, key or alias, ignoring case and punctuation', () => {
    const sheet = [
      ['Roll No', 'first_name', 'LAST NAME', 'E-mail', 'Sex', 'Dept', 'Programme', 'Sem', 'Batch', 'Favourite colour'],
      ['CS1', 'Asha', 'Rao', 'asha@x.edu', 'F', 'CSE', 'BTECH', 3, 2025, 'blue'],
      [null, '', null, null, null, null, null, null, null, null],
    ]
    const { rows, ignoredHeaders, missingColumns } = mapSheet(sheet, STUDENT_IMPORT_COLUMNS)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ rollNumber: 'CS1', firstName: 'Asha', email: 'asha@x.edu', gender: 'F', semester: 3, batchYear: 2025 })
    expect(ignoredHeaders).toEqual(['Favourite colour'])
    expect(missingColumns).toEqual([])
  })

  it('reports missing required columns', () => {
    const { missingColumns } = mapSheet([['Employee ID', 'Email']], TEACHER_IMPORT_COLUMNS)
    expect(missingColumns.map((c) => c.key)).toEqual(['firstName', 'lastName', 'department', 'designation'])
  })

  it('canonicalizes API rows keyed by any accepted header', () => {
    expect(canonicalizeRow({ 'Roll number': 'X1', 'e-mail': 'a@b.co', unknown: 1 }, STUDENT_IMPORT_COLUMNS)).toEqual({ rollNumber: 'X1', email: 'a@b.co' })
  })

  it('produces a template that maps back to every column', () => {
    const { rows, missingColumns } = mapSheet(parseCsv(templateCsv(STUDENT_IMPORT_COLUMNS)), STUDENT_IMPORT_COLUMNS)
    expect(missingColumns).toEqual([])
    expect(studentImportRowSchema.safeParse(rows[0]).success).toBe(true)
  })
})

describe('import row validation', () => {
  const valid = {
    rollNumber: 'CS1',
    firstName: 'Asha',
    lastName: 'Rao',
    email: 'Asha@X.edu ',
    gender: 'Female',
    department: 'CSE',
    course: 'BTECH',
    semester: '3',
    batchYear: 2025,
  }

  it('normalises cells', () => {
    const parsed = studentImportRowSchema.parse({ ...valid, dateOfBirth: new Date('2006-04-15T00:00:00Z'), phone: 9876543210 })
    expect(parsed.email).toBe('asha@x.edu')
    expect(parsed.gender).toBe('female')
    expect(parsed.semester).toBe(3)
    expect(parsed.dateOfBirth).toBe('2006-04-15')
    expect(parsed.phone).toBe('9876543210')
  })

  it('explains what is wrong', () => {
    const result = studentImportRowSchema.safeParse({ ...valid, email: 'nope', semester: 14, gender: 'x', dateOfBirth: '2006-02-30' })
    expect(result.success).toBe(false)
    const messages = result.success ? [] : result.error.issues.map((i) => i.message)
    expect(messages).toEqual(expect.arrayContaining(['Email is not valid', 'Semester must be 1–12', 'Gender must be male, female or other', 'Invalid date']))
  })

  it('requires the key teacher fields', () => {
    const result = teacherImportRowSchema.safeParse({ employeeId: 'E1', email: 'e@x.edu' })
    expect(result.success).toBe(false)
  })

  it('limits batch size and requires a strong enough initial password', () => {
    expect(importSchema.safeParse({ rows: [], password: 'longenough' }).success).toBe(false)
    expect(importSchema.safeParse({ rows: [{}], password: 'short' }).success).toBe(false)
    expect(importSchema.safeParse({ rows: Array.from({ length: 2001 }, () => ({})), password: 'longenough' }).success).toBe(false)
    expect(importSchema.parse({ rows: [{}], password: 'longenough' }).validateOnly).toBe(false)
  })
})
