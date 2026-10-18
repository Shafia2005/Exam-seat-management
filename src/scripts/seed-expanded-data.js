/* eslint-disable */
const fs = require('fs');
const path = require('path');

const firstNamesMale = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Advaith', 'Kabir', 'Ananya', 'Dhruv', 'Aryan', 'Kian',
  'Rudra', 'Rishi', 'Karan', 'Varun', 'Rohan', 'Kunal', 'Amit', 'Nikhil', 'Gaurav', 'Manish',
  'Siddharth', 'Harsh', 'Mohit', 'Ayush', 'Yash', 'Mayank', 'Tanmay', 'Alok', 'Deepak', 'Sanjay',
  'Dev', 'Om', 'Tejas', 'Samarth', 'Daksh', 'Chirag', 'Tushar', 'Sameer', 'Abhinav', 'Akash'
];

const firstNamesFemale = [
  'Aadhya', 'Ananya', 'Diya', 'Saanvi', 'Ira', 'Avani', 'Myra', 'Anvi', 'Prisha', 'Riya',
  'Aarohi', 'Anaya', 'Kavya', 'Siya', 'Navya', 'Pooja', 'Sneha', 'Tanvi', 'Anjali', 'Neha',
  'Priya', 'Meera', 'Ritu', 'Swati', 'Isha', 'Simran', 'Shruti', 'Divya', 'Shreya', 'Kritika',
  'Nidhi', 'Aditi', 'Disha', 'Khushi', 'Payal', 'Rashmi', 'Sonal', 'Pallavi', 'Megha', 'Sakshi'
];

const lastNames = [
  'Sharma', 'Verma', 'Patel', 'Kumar', 'Singh', 'Gupta', 'Reddy', 'Mehta', 'Nair', 'Iyer',
  'Chopra', 'Malhotra', 'Joshi', 'Bhat', 'Deshmukh', 'Kulkarni', 'Rao', 'Shetty', 'Pillai', 'Menon',
  'Banerjee', 'Chatterjee', 'Das', 'Sen', 'Ghosh', 'Mishra', 'Pandey', 'Tiwari', 'Dubey', 'Yadav',
  'Agarwal', 'Bhattacharya', 'Chauhan', 'Saxena', 'Kapoor', 'Bansal', 'Thakur', 'Tripathi'
];

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const branches = [
  { id: '1', name: 'Computer Science', courseId: '1', courseName: 'B.Tech Computer Science', code: 'CS' },
  { id: '2', name: 'Artificial Intelligence & ML', courseId: '4', courseName: 'B.Tech AI & Machine Learning', code: 'AIML' },
  { id: '3', name: 'Data Science & Big Data', courseId: '5', courseName: 'B.Tech Big Data & Data Analytics', code: 'DS' },
  { id: '4', name: 'Information Science', courseId: '6', courseName: 'B.Tech Information Science', code: 'IS' },
  { id: '5', name: 'Electronics & Communication', courseId: '2', courseName: 'B.Tech Electronics & Comm', code: 'EC' },
  { id: '6', name: 'Mechanical Engineering', courseId: '3', courseName: 'B.Tech Mechanical Engineering', code: 'ME' }
];

const semesters = [3, 4, 5, 6, 7, 8];

// Generate 120 diverse students
const students = [];
for (let i = 1; i <= 120; i++) {
  const isFemale = i % 3 === 0;
  const firstName = isFemale 
    ? firstNamesFemale[(i - 1) % firstNamesFemale.length]
    : firstNamesMale[(i - 1) % firstNamesMale.length];
  const lastName = lastNames[(i * 5) % lastNames.length];
  
  // Distribute across modern branches
  const branch = branches[(i - 1) % branches.length];
  const semester = semesters[(i - 1) % semesters.length];
  const batchYear = 2026 - Math.floor((semester + 1) / 2);

  const rollSeq = String(i).padStart(3, '0');
  const rollNumber = `${branch.code}${batchYear}${rollSeq}`;
  const regNumber = `REG${batchYear}${rollSeq}`;
  const blood = bloodGroups[i % bloodGroups.length];
  const section = i % 2 === 0 ? 'B' : 'A';
  
  // Attendance & eligibility
  const attendance = +(74 + ((i * 3.7) % 24)).toFixed(1);
  const isEligible = attendance >= 75 || i % 15 !== 0;

  students.push({
    id: String(i),
    rollNumber,
    registrationNumber: regNumber,
    firstName,
    lastName,
    email: i === 1 ? 'student@example.com' : `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
    phone: `987654${String(1000 + i).slice(1)}`,
    gender: isFemale ? 'female' : 'male',
    dateOfBirth: `${batchYear - 19}-0${1 + (i % 9)}-${String(10 + (i % 18)).padStart(2, '0')}`,
    bloodGroup: blood,
    departmentId: branch.id,
    departmentName: branch.name,
    courseId: branch.courseId,
    courseName: branch.courseName,
    currentSemester: semester,
    section,
    batchYear,
    admissionDate: `${batchYear}-08-01`,
    address: `${100 + i}, Tech Park Boulevard, Silicon City`,
    emergencyContactName: `Guardian of ${firstName}`,
    emergencyContactPhone: `987650${String(1000 + i).slice(1)}`,
    attendancePercentage: attendance,
    isEligible,
    eligibilityOverride: false,
    status: 'active',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-09-26T00:00:00Z'
  });
}

// 12 Faculty Members across branches
const teachers = [
  {
    id: "1",
    employeeId: "TCH001",
    firstName: "Dr. Rajesh",
    lastName: "Kumar",
    email: "rajesh.kumar@example.com",
    phone: "9876543230",
    departmentId: "1",
    departmentName: "Computer Science",
    designation: "Professor",
    specialization: "Artificial Intelligence & ML",
    qualification: "Ph.D. in Computer Science",
    experienceYears: 15,
    joiningDate: "2011-06-15",
    isAvailable: true,
    maxDutiesPerDay: 3,
    status: "active",
    createdAt: "2011-06-15T00:00:00Z",
    updatedAt: "2026-09-20T00:00:00Z"
  },
  {
    id: "2",
    employeeId: "TCH002",
    firstName: "Prof. Sunita",
    lastName: "Sharma",
    email: "teacher@example.com", // demo teacher login
    phone: "9876543231",
    departmentId: "3",
    departmentName: "Data Science & Big Data",
    designation: "Associate Professor",
    specialization: "Big Data Architectures & Analytics",
    qualification: "Ph.D. in Data Science",
    experienceYears: 11,
    joiningDate: "2015-07-01",
    isAvailable: true,
    maxDutiesPerDay: 3,
    status: "active",
    createdAt: "2015-07-01T00:00:00Z",
    updatedAt: "2026-09-20T00:00:00Z"
  },
  {
    id: "3",
    employeeId: "TCH003",
    firstName: "Dr. Mohan",
    lastName: "Patel",
    email: "mohan.patel@example.com",
    phone: "9876543232",
    departmentId: "5",
    departmentName: "Electronics & Communication",
    designation: "Professor",
    specialization: "VLSI Design & Embedded Systems",
    qualification: "Ph.D. in Electronics",
    experienceYears: 14,
    joiningDate: "2012-08-10",
    isAvailable: true,
    maxDutiesPerDay: 2,
    status: "active",
    createdAt: "2012-08-10T00:00:00Z",
    updatedAt: "2026-09-20T00:00:00Z"
  },
  {
    id: "4",
    employeeId: "TCH004",
    firstName: "Prof. Anil",
    lastName: "Gupta",
    email: "anil.gupta@example.com",
    phone: "9876543233",
    departmentId: "6",
    departmentName: "Mechanical Engineering",
    designation: "Assistant Professor",
    specialization: "Robotics & Automation",
    qualification: "M.Tech in Mechanical Engineering",
    experienceYears: 8,
    joiningDate: "2018-06-20",
    isAvailable: true,
    maxDutiesPerDay: 2,
    status: "active",
    createdAt: "2018-06-20T00:00:00Z",
    updatedAt: "2026-09-20T00:00:00Z"
  },
  {
    id: "5",
    employeeId: "TCH005",
    firstName: "Dr. Priya",
    lastName: "Verma",
    email: "priya.verma@example.com",
    phone: "9876543234",
    departmentId: "2",
    departmentName: "Artificial Intelligence & ML",
    designation: "Assistant Professor",
    specialization: "Deep Learning & NLP",
    qualification: "Ph.D. in AI",
    experienceYears: 6,
    joiningDate: "2020-07-15",
    isAvailable: true,
    maxDutiesPerDay: 3,
    status: "active",
    createdAt: "2020-07-15T00:00:00Z",
    updatedAt: "2026-09-20T00:00:00Z"
  },
  {
    id: "6",
    employeeId: "TCH006",
    firstName: "Prof. Vikram",
    lastName: "Rao",
    email: "vikram.rao@example.com",
    phone: "9876543235",
    departmentId: "1",
    departmentName: "Computer Science",
    designation: "Assistant Professor",
    specialization: "Cybersecurity & Cloud Computing",
    qualification: "M.Tech in Cyber Security",
    experienceYears: 5,
    joiningDate: "2021-09-01",
    isAvailable: true,
    maxDutiesPerDay: 2,
    status: "active",
    createdAt: "2021-09-01T00:00:00Z",
    updatedAt: "2026-09-20T00:00:00Z"
  },
  {
    id: "7",
    employeeId: "TCH007",
    firstName: "Prof. Neha",
    lastName: "Kulkarni",
    email: "neha.kulkarni@example.com",
    phone: "9876543236",
    departmentId: "3",
    departmentName: "Data Science & Big Data",
    designation: "Associate Professor",
    specialization: "Distributed Computing & Hadoop",
    qualification: "Ph.D. in Data Analytics",
    experienceYears: 10,
    joiningDate: "2016-03-12",
    isAvailable: true,
    maxDutiesPerDay: 2,
    status: "active",
    createdAt: "2016-03-12T00:00:00Z",
    updatedAt: "2026-09-20T00:00:00Z"
  },
  {
    id: "8",
    employeeId: "TCH008",
    firstName: "Dr. Ramesh",
    lastName: "Iyer",
    email: "ramesh.iyer@example.com",
    phone: "9876543237",
    departmentId: "5",
    departmentName: "Electronics & Communication",
    designation: "Assistant Professor",
    specialization: "IoT & Wireless Sensor Networks",
    qualification: "Ph.D. in ECE",
    experienceYears: 7,
    joiningDate: "2019-01-18",
    isAvailable: true,
    maxDutiesPerDay: 3,
    status: "active",
    createdAt: "2019-01-18T00:00:00Z",
    updatedAt: "2026-09-20T00:00:00Z"
  },
  {
    id: "9",
    employeeId: "TCH009",
    firstName: "Prof. Kavita",
    lastName: "Menon",
    email: "kavita.menon@example.com",
    phone: "9876543238",
    departmentId: "4",
    departmentName: "Information Science",
    designation: "Assistant Professor",
    specialization: "Information Systems & Algorithms",
    qualification: "M.Tech in Information Tech",
    experienceYears: 6,
    joiningDate: "2020-08-25",
    isAvailable: true,
    maxDutiesPerDay: 2,
    status: "active",
    createdAt: "2020-08-25T00:00:00Z",
    updatedAt: "2026-09-20T00:00:00Z"
  },
  {
    id: "10",
    employeeId: "TCH010",
    firstName: "Dr. Suresh",
    lastName: "Nambiar",
    email: "suresh.nambiar@example.com",
    phone: "9876543239",
    departmentId: "6",
    departmentName: "Mechanical Engineering",
    designation: "Professor",
    specialization: "Mechatronics & Additive Manufacturing",
    qualification: "Ph.D. in Robotics",
    experienceYears: 16,
    joiningDate: "2010-11-05",
    isAvailable: true,
    maxDutiesPerDay: 3,
    status: "active",
    createdAt: "2010-11-05T00:00:00Z",
    updatedAt: "2026-09-20T00:00:00Z"
  },
  {
    id: "11",
    employeeId: "TCH011",
    firstName: "Prof. Deepa",
    lastName: "Joshi",
    email: "deepa.joshi@example.com",
    phone: "9876543240",
    departmentId: "2",
    departmentName: "Artificial Intelligence & ML",
    designation: "Associate Professor",
    specialization: "Computer Vision & Generative AI",
    qualification: "Ph.D. in Computer Science",
    experienceYears: 9,
    joiningDate: "2017-04-10",
    isAvailable: true,
    maxDutiesPerDay: 2,
    status: "active",
    createdAt: "2017-04-10T00:00:00Z",
    updatedAt: "2026-09-20T00:00:00Z"
  },
  {
    id: "12",
    employeeId: "TCH012",
    firstName: "Dr. Arvind",
    lastName: "Swamy",
    email: "arvind.swamy@example.com",
    phone: "9876543241",
    departmentId: "4",
    departmentName: "Information Science",
    designation: "Assistant Professor",
    specialization: "Software Architecture & DevOps",
    qualification: "Ph.D. in Software Engineering",
    experienceYears: 5,
    joiningDate: "2021-10-15",
    isAvailable: true,
    maxDutiesPerDay: 2,
    status: "active",
    createdAt: "2021-10-15T00:00:00Z",
    updatedAt: "2026-09-20T00:00:00Z"
  }
];

// Update exams.json with current September / October 2026 dates
const exams = [
  {
    id: "1",
    name: "Mid-Semester Examination (Autumn 2026)",
    examType: "mid_sem",
    academicYear: "2026-27",
    semester: 6,
    startDate: "2026-09-28",
    endDate: "2026-10-08",
    description: "Autumn 2026 Mid-Semester exams for CSE, AIML, Big Data, ISE, ECE, and ME branches",
    instructions: "Students must carry official hall tickets and student ID. Report 20 minutes prior to session.",
    status: "scheduled",
    createdBy: "1",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-26T00:00:00Z",
    subjects: [
      {
        id: "1",
        examId: "1",
        subjectId: "1",
        subjectName: "AI & Machine Learning Foundations",
        examDate: "2026-09-28",
        startTime: "09:30",
        endTime: "12:30",
        durationMinutes: 180,
        maximumMarks: 100,
        passingMarks: 40
      },
      {
        id: "2",
        examId: "1",
        subjectId: "2",
        subjectName: "Big Data Analytics & Cloud Systems",
        examDate: "2026-09-30",
        startTime: "09:30",
        endTime: "12:30",
        durationMinutes: 180,
        maximumMarks: 100,
        passingMarks: 40
      },
      {
        id: "3",
        examId: "1",
        subjectId: "3",
        subjectName: "Distributed Operating Systems",
        examDate: "2026-10-03",
        startTime: "14:00",
        endTime: "17:00",
        durationMinutes: 180,
        maximumMarks: 100,
        passingMarks: 40
      }
    ]
  },
  {
    id: "2",
    name: "End-Semester Final Examination 2026",
    examType: "final",
    academicYear: "2026-27",
    semester: 8,
    startDate: "2026-10-15",
    endDate: "2026-10-28",
    description: "Final degree examinations for all senior graduating batches",
    instructions: "Strict proctoring in place. Mobile phones and unauthorized smart devices prohibited.",
    status: "scheduled",
    createdBy: "1",
    createdAt: "2026-09-10T00:00:00Z",
    updatedAt: "2026-09-26T00:00:00Z",
    subjects: [
      {
        id: "4",
        examId: "2",
        subjectId: "4",
        subjectName: "Advanced Deep Neural Networks",
        examDate: "2026-10-15",
        startTime: "09:30",
        endTime: "12:30",
        durationMinutes: 180,
        maximumMarks: 100,
        passingMarks: 40
      },
      {
        id: "5",
        examId: "2",
        subjectId: "5",
        subjectName: "High Performance Computing & Big Data",
        examDate: "2026-10-18",
        startTime: "09:30",
        endTime: "12:30",
        durationMinutes: 180,
        maximumMarks: 100,
        passingMarks: 40
      }
    ]
  }
];

const dataDir = path.join(__dirname, '..', 'services', 'mock', 'data');
fs.writeFileSync(path.join(dataDir, 'students.json'), JSON.stringify(students, null, 2), 'utf-8');
fs.writeFileSync(path.join(dataDir, 'teachers.json'), JSON.stringify(teachers, null, 2), 'utf-8');
fs.writeFileSync(path.join(dataDir, 'exams.json'), JSON.stringify(exams, null, 2), 'utf-8');

console.log(`Successfully generated ${students.length} students across 6 branches and semesters.`);
console.log(`Updated exams with current September/October 2026 dates.`);
