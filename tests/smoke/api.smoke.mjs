// End-to-end smoke test against a running server with the demo seed loaded.
//
//   npm run db:seed && npm run dev        (in another terminal)
//   npm run test:smoke                    (or: node tests/smoke/api.smoke.mjs http://localhost:3000)
//
// It changes demo data slightly (re-seats today's paper, marks one attendance
// seat, adds and then removes a test exam and test students). Run
// `npm run db:seed` afterwards for pristine demo data.

const BASE = (process.argv[2] || process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const ORG = 'apex-institute'
let passed = 0
let failed = 0

function check(name, cond, extra) {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 500) : '')
  }
}

class Client {
  constructor(name) {
    this.name = name
    this.cookies = new Map()
  }
  async req(method, path, body) {
    const headers = {}
    if (this.cookies.size) headers.cookie = Array.from(this.cookies, ([k, v]) => `${k}=${v}`).join('; ')
    if (body !== undefined) headers['content-type'] = 'application/json'
    const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: 'manual' })
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(';')
      const [k, ...v] = pair.split('=')
      const value = v.join('=')
      const expired = attrs.some((a) => /max-age=0/i.test(a) || /expires=thu, 01 jan 1970/i.test(a))
      if (!value || expired) this.cookies.delete(k.trim())
      else this.cookies.set(k.trim(), value)
    }
    const type = res.headers.get('content-type') || ''
    if (type.includes('application/json')) return { status: res.status, json: await res.json(), headers: res.headers }
    const buf = Buffer.from(await res.arrayBuffer())
    return { status: res.status, text: buf.toString('utf8'), bytes: buf, headers: res.headers }
  }
  get = (p) => this.req('GET', p)
  post = (p, b) => this.req('POST', p, b ?? {})
  put = (p, b) => this.req('PUT', p, b)
  patch = (p, b) => this.req('PATCH', p, b)
  del = (p) => this.req('DELETE', p)
  async login(identifier, password) {
    const r = await this.post('/api/auth/login', { organization: ORG, identifier, password })
    if (r.status !== 200) throw new Error(`${this.name} login failed: ${r.status} ${JSON.stringify(r.json)}`)
    return r
  }
}

const q = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined)).toString()

async function main() {
  console.log(`SeatGuard smoke test → ${BASE}\n`)
  const admin = new Client('admin')
  const teacher = new Client('teacher')
  const student = new Client('student')
  const anon = new Client('anon')

  await admin.login('admin@example.com', 'admin123')
  await teacher.login('teacher@example.com', 'teacher123')
  await student.login('student@example.com', 'student123')

  // ── Calendar-driven exam status ──
  console.log('Exam status follows the calendar')
  const exams = (await admin.get('/api/exams?limit=100')).json.data
  const finished = exams.find((e) => e.name.startsWith('Mid-Semester'))
  const current = exams.find((e) => e.name.startsWith('End-Semester'))
  check('past exam is completed', finished?.status === 'completed', finished?.status)
  check('current exam is ongoing', current?.status === 'ongoing', current?.status)
  const [pastPaper, todayPaper] = current.subjects

  // ── Seating per paper ──
  console.log('Seating per paper')
  const summary = (await admin.get('/api/seats/summary')).json.data
  check('summary lists both exams', summary.exams.length >= 2, summary.exams)
  const plans = (await admin.get(`/api/seats/allocation?${q({ examId: current.id })}`)).json.data
  check('one seating plan per paper', plans.length === current.subjects.length, plans.map((p) => p.subjectName))
  const locked = await admin.post('/api/seats/allocate', { examId: finished.id, selection: {}, algorithm: 'anti_cheating' })
  check('completed exam cannot be re-seated', locked.status === 409 && locked.json.error.code === 'EXAM_NOT_PUBLISHED', locked.json)
  const marked = await admin.post('/api/seats/allocate', { examId: current.id, sessionIds: [pastPaper.id], selection: {}, algorithm: 'random' })
  check('paper with attendance cannot be re-seated', marked.status === 409 && marked.json.error.code === 'ATTENDANCE_RECORDED', marked.json)

  const depts = (await admin.get('/api/departments')).json.data
  const rooms = (await admin.get('/api/rooms')).json.data
  const twoRooms = rooms.slice(0, 2).map((r) => r.id)
  const deptCount = (await admin.get(`/api/students?${q({ departmentIds: depts[0].id, status: 'active', eligibility: 'eligible', limit: 1 })}`)).json.meta.pagination.total
  const partial = await admin.post('/api/seats/allocate', {
    examId: current.id,
    sessionIds: [todayPaper.id],
    selection: { departmentIds: [depts[0].id] },
    algorithm: 'anti_cheating',
    roomIds: twoRooms,
  })
  check('server-side selection seats every matching student', partial.status === 200 && partial.json.data.allocatedStudents === deptCount, {
    status: partial.status,
    seated: partial.json.data?.allocatedStudents,
    deptCount,
  })
  const all = await admin.post('/api/seats/allocate', { examId: current.id, sessionIds: [todayPaper.id], selection: {}, algorithm: 'anti_cheating', roomIds: twoRooms })
  check('re-seat today’s paper for everyone', all.status === 200 && all.json.data.allocatedStudents === 120, all.json.data?.errors)
  const otherPaper = (await admin.get(`/api/seats/allocation?${q({ sessionId: pastPaper.id })}`)).json.data[0]
  check('other paper keeps its own seating and attendance', otherPaper?.allocations.some((a) => a.attendanceStatus), otherPaper?.allocations.length)

  // ── Duties: per paper, conflicts and daily limits ──
  console.log('Invigilation')
  const roster = (await admin.get(`/api/duties?${q({ sessionId: todayPaper.id })}`)).json.data
  check('roster for today’s paper', roster.duties.length >= 2, roster.duties.length)
  const workload = (await admin.get(`/api/duties/workload?${q({ sessionId: todayPaper.id })}`)).json.data
  check('workload marks invigilators already busy this slot', workload.some((w) => w.busy), workload.map((w) => [w.employeeId, w.busy]))
  const busyDuty = roster.duties[0]
  const otherRoom = roster.duties.find((d) => d.roomId !== busyDuty.roomId)
  const clash = await admin.post('/api/duties', { sessionId: todayPaper.id, roomId: otherRoom.roomId, teacherId: busyDuty.teacherId, role: 'Invigilator' })
  check('same teacher in two halls at once is refused', clash.status === 409 && clash.json.error.code === 'DUTY_CONFLICT', clash.json)
  const lockedDuty = await admin.post('/api/duties/auto-allocate', { examId: finished.id, strategy: 'fair_distribution' })
  check('completed exam roster is locked', lockedDuty.status === 409, lockedDuty.json)

  // ── Exam-day attendance ──
  console.log('Exam-day attendance')
  const mine = (await teacher.get('/api/duties/my-duties')).json.data
  const todayDuty = mine.duties.find((d) => d.sessionId === todayPaper.id)
  check('teacher has a duty for today’s paper', !!todayDuty, mine.duties.map((d) => d.subjectName))
  if (todayDuty) {
    check('attendance is open today', todayDuty.attendanceOpen === true, todayDuty)
    const hall = await teacher.get(`/api/attendance?${q({ sessionId: todayPaper.id, roomId: todayDuty.roomId })}`)
    check('teacher opens their hall', hall.status === 200 && hall.json.data.seats.length > 0, hall.json)
    const seat = hall.json.data.seats[0]
    const mark = await teacher.put('/api/attendance', { sessionId: todayPaper.id, roomId: todayDuty.roomId, marks: [{ allocationId: seat.allocationId, status: 'present' }] })
    check('teacher marks a student present', mark.status === 200 && mark.json.data.summary.present >= 1, mark.json)
    const reseat = await admin.post('/api/seats/allocate', { examId: current.id, sessionIds: [todayPaper.id], selection: {}, algorithm: 'random' })
    check('seating is protected once attendance starts', reseat.status === 409, reseat.json)
    const foreignRoom = rooms.find((r) => !mine.duties.some((d) => d.sessionId === todayPaper.id && d.roomId === r.id))
    const foreign = await teacher.get(`/api/attendance?${q({ sessionId: todayPaper.id, roomId: foreignRoom.id })}`)
    check('teacher cannot open another hall', foreign.status === 403, foreign.status)
  }
  const report = await admin.get(`/api/attendance/summary?${q({ examId: current.id })}`)
  check('attendance summary per paper', report.status === 200 && report.json.data.length === current.subjects.length, report.json)
  check('teachers cannot read the summary', (await teacher.get(`/api/attendance/summary?${q({ examId: current.id })}`)).status === 403)

  // ── Papers: add/edit/delete, and attendance closed before the paper's date ──
  console.log('Exams & papers')
  const inDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
  const created = await admin.post('/api/exams', {
    name: `Smoke test exam ${Date.now()}`,
    examType: 'internal',
    academicYear: '2026-27',
    semester: 3,
    startDate: inDays(40),
    endDate: inDays(44),
    subjects: [{ subjectName: 'Smoke paper', examDate: inDays(41), startTime: '10:00', endTime: '12:00', durationMinutes: 120 }],
  })
  check('create exam with a paper (draft)', created.status === 201 && created.json.data.status === 'draft', created.json)
  const testExam = created.json.data
  const published = await admin.put(`/api/exams/${testExam.id}`, { status: 'scheduled' })
  check('publish → scheduled (future dates)', published.json.data?.status === 'scheduled', published.json)
  const paper = testExam.subjects[0]
  const edited = await admin.patch(`/api/exams/${testExam.id}/sessions/${paper.id}`, { startTime: '11:00', endTime: '13:00' })
  check('edit a paper', edited.status === 200 && edited.json.data.subjects[0].startTime === '11:00', edited.json)
  const outside = await admin.patch(`/api/exams/${testExam.id}/sessions/${paper.id}`, { examDate: inDays(400) })
  check('paper date must fall within the exam', outside.status === 400, outside.json)
  const futureSeat = await admin.post('/api/seats/allocate', { examId: testExam.id, selection: { departmentIds: [depts[0].id] }, algorithm: 'sequential', roomIds: [rooms[2].id] })
  check('seat a future paper', futureSeat.status === 200 && futureSeat.json.data.allocatedStudents > 0, futureSeat.json)
  const auto = await admin.post('/api/duties/auto-allocate', { examId: testExam.id, strategy: 'fair_distribution', invigilatorsPerRoom: 2 })
  check('auto-allocate invigilators', auto.status === 200 && auto.json.data.created === 2 && Array.isArray(auto.json.data.warnings), auto.json)
  const futureHall = await admin.get(`/api/attendance?${q({ sessionId: paper.id, roomId: rooms[2].id })}`)
  check('attendance is closed before the paper date', futureHall.json.data?.open === false, futureHall.json)
  const early = await admin.put('/api/attendance', { sessionId: paper.id, roomId: rooms[2].id, marks: [{ allocationId: futureHall.json.data.seats[0].allocationId, status: 'present' }] })
  check('marking early is refused', early.status === 409 && early.json.error.code === 'ATTENDANCE_CLOSED', early.json)
  const removed = await admin.del(`/api/exams/${testExam.id}/sessions/${paper.id}`)
  check('delete a paper', removed.status === 200 && removed.json.data.subjects.length === 0, removed.json)
  check('delete the test exam', (await admin.del(`/api/exams/${testExam.id}`)).status === 200)

  // ── Hall ticket PDF + QR verification ──
  console.log('Hall tickets')
  const seatInfo = (await student.get('/api/seats/my-seat')).json.data
  check('student sees one seat per paper', seatInfo.allocations.length === 5, seatInfo.allocations.length)
  const ticket = seatInfo.hallTickets.find((t) => t.examId === current.id)
  check('hall-ticket token issued', !!ticket?.token)
  const pdf = await student.get(`/api/seats/hall-ticket?${q({ examId: current.id })}`)
  check('PDF downloads', pdf.status === 200 && pdf.headers.get('content-type') === 'application/pdf' && pdf.text.startsWith('%PDF'), pdf.status)
  const otherPdf = await student.get(`/api/seats/hall-ticket?${q({ examId: current.id, studentId: 'someone-else' })}`)
  check('students only get their own ticket', otherPdf.status === 200, otherPdf.status)
  const verified = await anon.get(`/verify/${ticket.token}`)
  check('QR verify page says genuine', verified.status === 200 && verified.text.includes('Genuine hall ticket'), verified.status)
  const forged = await anon.get(`/verify/${ticket.token.slice(0, -4)}AAAA`)
  check('tampered token is rejected', forged.status === 200 && forged.text.includes('Not valid'), forged.status)

  // ── Notifications ──
  console.log('Notifications')
  const status = (await admin.get('/api/notifications/status')).json.data
  check('delivery status reported', ['smtp', 'log'].includes(status.email) && ['twilio', 'log'].includes(status.sms), status)
  const notify = await admin.post('/api/seats/notify', { examId: current.id, channels: ['email', 'sms'] })
  check('notify seated students', notify.status === 200 && notify.json.data.recipients === 120, notify.json)
  const duties = await admin.post('/api/duties/notify', { examId: current.id, channels: ['email'] })
  check('notify invigilators', duties.status === 200 && duties.json.data.recipients > 0, duties.json)
  const outbox = await admin.get('/api/notifications?limit=5')
  check('outbox lists messages', outbox.status === 200 && outbox.json.data.length > 0, outbox.json)

  // ── Bulk import ──
  console.log('Bulk import')
  const stamp = Date.now().toString().slice(-6)
  const rows = [
    { 'Roll number': `SMK${stamp}`, 'First name': 'Smoke', 'Last name': 'Tester', Email: `smoke${stamp}@example.com`, Gender: 'F', Department: depts[0].code, Course: (await admin.get(`/api/courses?${q({ departmentId: depts[0].id })}`)).json.data[0].code, Semester: 3, 'Batch year': 2025 },
    { 'Roll number': 'CS2024001', 'First name': 'Dup', 'Last name': 'Licate', Email: `dup${stamp}@example.com`, Gender: 'male', Department: depts[0].code, Course: 'X', Semester: 3, 'Batch year': 2025 },
    { 'Roll number': `BAD${stamp}`, 'First name': 'Bad', 'Last name': 'Email', Email: 'not-an-email', Gender: 'male', Department: depts[0].code, Course: 'X', Semester: 3, 'Batch year': 2025 },
  ]
  const preview = await admin.post('/api/students/import', { rows, password: 'Welcome@123', validateOnly: true })
  check('preview finds 1 valid and 2 bad rows', preview.status === 200 && preview.json.data.failed === 2 && preview.json.data.created === 0, preview.json)
  const imported = await admin.post('/api/students/import', { rows, password: 'Welcome@123', validateOnly: false })
  check('import creates the valid row', imported.json.data?.created === 1, imported.json)
  const teacherPreview = await admin.post('/api/teachers/import', {
    rows: [{ 'Employee ID': `SMKT${stamp}`, 'First name': 'Tea', 'Last name': 'Cher', Email: `t${stamp}@example.com`, Department: depts[0].name, Designation: 'Lecturer' }],
    password: 'Welcome@123',
    validateOnly: true,
  })
  check('teacher import preview', teacherPreview.json.data?.failed === 0, teacherPreview.json)

  // ── Forgot / reset password (on the imported account) ──
  console.log('Forgot password')
  const forgot = await anon.post('/api/auth/forgot-password', { organization: ORG, email: `smoke${stamp}@example.com` })
  check('reset link issued', forgot.status === 200 && !!forgot.json.data.message, forgot.json)
  const unknown = await anon.post('/api/auth/forgot-password', { organization: ORG, email: `nobody${stamp}@example.com` })
  check('same answer for unknown emails', unknown.status === 200 && unknown.json.data.message === forgot.json.data.message && !unknown.json.data.devResetUrl)
  const devUrl = forgot.json.data.devResetUrl
  if (devUrl) {
    const token = new URL(devUrl).searchParams.get('token')
    const reset = await anon.post('/api/auth/reset-password', { token, password: 'Changed@456' })
    check('password reset with the link', reset.status === 200, reset.json)
    const reuse = await anon.post('/api/auth/reset-password', { token, password: 'Again@7890' })
    check('link works only once', reuse.status === 400, reuse.json)
    const relog = await new Client('imported').post('/api/auth/login', { organization: ORG, identifier: `smoke${stamp}@example.com`, password: 'Changed@456' })
    check('sign in with the new password', relog.status === 200, relog.json)
  } else {
    console.log('  (SMTP configured — skipped the link step)')
  }
  const importedRow = (await admin.get(`/api/students?${q({ search: `SMK${stamp}` })}`)).json.data[0]
  if (importedRow) check('clean up imported student', (await admin.del(`/api/students/${importedRow.id}`)).status === 200)

  // ── Administrators ──
  console.log('Administrators')
  const admins = (await admin.get('/api/admins')).json.data
  const me = admins.find((a) => a.email === 'admin@example.com')
  check('admin list', admins.length >= 1 && me?.role === 'SUPER_ADMIN', admins)
  const selfDemote = await admin.patch(`/api/admins/${me.id}`, { role: 'ADMIN' })
  check('cannot demote yourself', selfDemote.status === 409, selfDemote.json)
  const newAdmin = await admin.post('/api/admins', { firstName: 'Smoke', lastName: 'Admin', email: `smoke.admin${stamp}@example.com`, role: 'ADMIN' })
  check('add administrator (temporary password)', newAdmin.status === 201 && !!newAdmin.json.meta.temporaryPassword, newAdmin.json)
  const second = new Client('second')
  await second.login(`smoke.admin${stamp}@example.com`, newAdmin.json.meta.temporaryPassword)
  check('plain admins cannot add admins', (await second.post('/api/admins', { firstName: 'X', lastName: 'Y', email: `x${stamp}@example.com` })).status === 403)
  const off = await admin.patch(`/api/admins/${newAdmin.json.data.id}`, { isActive: false })
  check('deactivate administrator', off.status === 200 && off.json.data.isActive === false, off.json)
  check('deactivated admin is signed out', (await second.get('/api/auth/me')).status === 401)

  // ── Institution threshold ──
  console.log('Attendance threshold')
  const org = (await admin.get('/api/organization')).json.data
  const raised = await admin.patch('/api/organization', { minAttendancePercent: 95 })
  check('raising the threshold re-evaluates students', raised.status === 200 && raised.json.data.eligibilityChanged > 0, raised.json)
  const restored = await admin.patch('/api/organization', { minAttendancePercent: org.minAttendancePercent })
  check('restore the threshold', restored.json.data?.minAttendancePercent === org.minAttendancePercent, restored.json)
  check('invalid timezone rejected', (await admin.patch('/api/organization', { timezone: 'Mars/Olympus' })).status === 400)

  // ── Change history ──
  console.log('Audit log')
  const audit = (await admin.get('/api/audit-logs?limit=100')).json.data
  const actions = new Set(audit.map((a) => a.action))
  ;['seating.allocated', 'attendance.marked', 'student.imported', 'admin.created', 'organization.updated', 'notification.seating-sent'].forEach((a) =>
    check(`audit has ${a}`, actions.has(a))
  )

  // ── Pages & access ──
  console.log('Pages')
  const pages = [
    ['/dashboard', 'Dashboard'],
    ['/seat-allocation', 'Seat allocation'],
    ['/teacher-allocation', 'Invigilation'],
    ['/attendance', 'Exam-day attendance'],
    ['/reports', 'Reports'],
    ['/activity', 'Activity'],
    ['/settings', 'Settings'],
    ['/students', 'Students'],
    ['/exams', 'Exam schedule'],
  ]
  for (const [path, title] of pages) {
    const r = await admin.get(path)
    check(`${path} has title “${title}”`, r.status === 200 && r.text.includes(`<title>${title} · SeatGuard</title>`), r.status)
  }
  check('/forgot-password is public', (await anon.get('/forgot-password')).status === 200)
  check('/attendance needs a session', [302, 307].includes((await anon.get('/attendance')).status))
  check('students cannot open /attendance', [302, 307].includes((await student.get('/attendance')).status))
  check('teachers cannot open /activity', [302, 307].includes((await teacher.get('/activity')).status))

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exitCode = failed ? 1 : 0
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
