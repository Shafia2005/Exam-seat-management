// Column definitions for bulk importing students and teachers from Excel/CSV.
// Shared by the import dialog (template, header matching, preview) and the API,
// which accepts either canonical keys or any of the listed header aliases.

export interface ImportColumn {
  key: string
  label: string
  required: boolean
  /** Header spellings accepted in addition to the label and key. */
  aliases: string[]
  example: string
  hint?: string
}

export const STUDENT_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'rollNumber', label: 'Roll number', required: true, aliases: ['roll', 'roll no', 'roll_no', 'rollno'], example: 'CS2026101' },
  { key: 'firstName', label: 'First name', required: true, aliases: ['first', 'given name'], example: 'Asha' },
  { key: 'lastName', label: 'Last name', required: true, aliases: ['last', 'surname', 'family name'], example: 'Rao' },
  { key: 'email', label: 'Email', required: true, aliases: ['email address', 'e-mail', 'mail'], example: 'asha.rao@example.edu' },
  { key: 'gender', label: 'Gender', required: true, aliases: ['sex'], example: 'female', hint: 'male, female or other' },
  { key: 'department', label: 'Department', required: true, aliases: ['dept', 'department code', 'department name'], example: 'CSE', hint: 'Department code or name' },
  { key: 'course', label: 'Course', required: true, aliases: ['course code', 'course name', 'program', 'programme'], example: 'BTECH-CSE', hint: 'Course code or name' },
  { key: 'semester', label: 'Semester', required: true, aliases: ['sem', 'current semester'], example: '3' },
  { key: 'batchYear', label: 'Batch year', required: true, aliases: ['batch', 'admission year'], example: '2025' },
  { key: 'section', label: 'Section', required: false, aliases: ['sec', 'division'], example: 'A' },
  { key: 'registrationNumber', label: 'Registration number', required: false, aliases: ['reg no', 'registration no', 'regno', 'reg number'], example: 'REG2025101' },
  { key: 'phone', label: 'Phone', required: false, aliases: ['mobile', 'phone number', 'contact'], example: '9876543210' },
  { key: 'dateOfBirth', label: 'Date of birth', required: false, aliases: ['dob', 'birth date'], example: '2006-04-15', hint: 'YYYY-MM-DD' },
]

export const TEACHER_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'employeeId', label: 'Employee ID', required: true, aliases: ['employee id', 'emp id', 'empid', 'staff id'], example: 'EMP101' },
  { key: 'firstName', label: 'First name', required: true, aliases: ['first', 'given name'], example: 'Ravi' },
  { key: 'lastName', label: 'Last name', required: true, aliases: ['last', 'surname', 'family name'], example: 'Kumar' },
  { key: 'email', label: 'Email', required: true, aliases: ['email address', 'e-mail', 'mail'], example: 'ravi.kumar@example.edu' },
  { key: 'department', label: 'Department', required: true, aliases: ['dept', 'department code', 'department name'], example: 'CSE', hint: 'Department code or name' },
  { key: 'designation', label: 'Designation', required: true, aliases: ['title', 'position'], example: 'Assistant Professor' },
  { key: 'phone', label: 'Phone', required: false, aliases: ['mobile', 'phone number', 'contact'], example: '9876500001' },
  { key: 'qualification', label: 'Qualification', required: false, aliases: ['degree'], example: 'M.Tech' },
  { key: 'specialization', label: 'Specialization', required: false, aliases: ['subject', 'area'], example: 'Databases' },
  { key: 'experienceYears', label: 'Experience (years)', required: false, aliases: ['experience', 'years of experience'], example: '6' },
  { key: 'maxDutiesPerDay', label: 'Max duties per day', required: false, aliases: ['max duties', 'duties per day'], example: '2' },
]

export const normalizeHeader = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, '')

function headerIndex(columns: ImportColumn[]): Map<string, string> {
  const index = new Map<string, string>()
  columns.forEach((c) => {
    ;[c.key, c.label, ...c.aliases].forEach((name) => index.set(normalizeHeader(name), c.key))
  })
  return index
}

/** Maps a row keyed by any accepted header spelling to canonical column keys. Unknown keys are dropped. */
export function canonicalizeRow(row: Record<string, unknown>, columns: ImportColumn[]): Record<string, unknown> {
  const index = headerIndex(columns)
  const out: Record<string, unknown> = {}
  Object.keys(row).forEach((key) => {
    const canonical = index.get(normalizeHeader(key))
    if (canonical && out[canonical] === undefined) out[canonical] = row[key]
  })
  return out
}

export interface SheetMapping {
  rows: Record<string, unknown>[]
  /** Headers that matched no column; their data is ignored. */
  ignoredHeaders: string[]
  /** Required columns not found in the header row. */
  missingColumns: ImportColumn[]
}

/** Turns a sheet (first row = headers) into rows keyed by column key, skipping blank rows. */
export function mapSheet(sheet: unknown[][], columns: ImportColumn[]): SheetMapping {
  const [header = [], ...data] = sheet
  const index = headerIndex(columns)
  const keys = header.map((h) => (h === null || h === undefined ? undefined : index.get(normalizeHeader(String(h)))))
  const ignoredHeaders = header
    .filter((h, i) => h !== null && h !== undefined && String(h).trim() !== '' && !keys[i])
    .map((h) => String(h))
  const found = new Set(keys.filter(Boolean))
  const missingColumns = columns.filter((c) => c.required && !found.has(c.key))

  const rows = data
    .filter((cells) => cells.some((c) => c !== null && c !== undefined && String(c).trim() !== ''))
    .map((cells) => {
      const row: Record<string, unknown> = {}
      keys.forEach((key, i) => {
        if (key && row[key] === undefined) row[key] = cells[i] ?? null
      })
      return row
    })
  return { rows, ignoredHeaders, missingColumns }
}

const csvCell = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

/** A CSV template with the header row and one example row. */
export function templateCsv(columns: ImportColumn[]): string {
  return [columns.map((c) => csvCell(c.label)).join(','), columns.map((c) => csvCell(c.example)).join(',')].join('\r\n') + '\r\n'
}

/** RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF/LF, optional BOM). */
export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  // Excel saves CSV with ";" in locales that use "," as the decimal separator.
  const firstLine = input.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"' && field === '') {
      quoted = true
    } else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}
