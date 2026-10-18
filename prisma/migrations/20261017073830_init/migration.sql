-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'GRADUATED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "TeacherStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('MID_SEM', 'INTERNAL', 'FINAL', 'SUPPLEMENTARY', 'PRACTICAL');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AllocationAlgorithm" AS ENUM ('SEQUENTIAL', 'RANDOM', 'DEPARTMENT_WISE', 'ANTI_CHEATING');

-- CreateEnum
CREATE TYPE "DutyRole" AS ENUM ('CHIEF_INVIGILATOR', 'INVIGILATOR', 'RELIEVER');

-- CreateEnum
CREATE TYPE "DutyStatus" AS ENUM ('ASSIGNED', 'CONFIRMED', 'SUBSTITUTED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "domain" TEXT,
    "logoUrl" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "durationYears" INTEGER NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "phone" TEXT,
    "specialization" TEXT,
    "qualification" TEXT,
    "experienceYears" INTEGER NOT NULL DEFAULT 0,
    "joiningDate" DATE,
    "maxDuties" INTEGER NOT NULL DEFAULT 2,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "status" "TeacherStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rollNumber" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "departmentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "currentSemester" INTEGER NOT NULL,
    "section" TEXT,
    "batchYear" INTEGER NOT NULL,
    "gender" "Gender" NOT NULL,
    "dateOfBirth" DATE,
    "bloodGroup" TEXT,
    "phone" TEXT,
    "admissionDate" DATE,
    "address" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "attendancePercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isEligible" BOOLEAN NOT NULL DEFAULT true,
    "eligibilityOverride" BOOLEAN NOT NULL DEFAULT false,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "buildingName" TEXT,
    "floor" INTEGER,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "floor" INTEGER,
    "rows" INTEGER NOT NULL,
    "columns" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bench" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "column" INTEGER NOT NULL,
    "seatsPerBench" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bench_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "examType" "ExamType" NOT NULL,
    "academicYear" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "subjectCode" TEXT,
    "examDate" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "maximumMarks" INTEGER NOT NULL DEFAULT 100,
    "passingMarks" INTEGER NOT NULL DEFAULT 40,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatAllocation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "benchId" TEXT NOT NULL,
    "seatPosition" INTEGER NOT NULL DEFAULT 1,
    "seatLabel" TEXT NOT NULL,
    "algorithm" "AllocationAlgorithm",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeatAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvigilationDuty" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "role" "DutyRole" NOT NULL DEFAULT 'INVIGILATOR',
    "status" "DutyStatus" NOT NULL DEFAULT 'ASSIGNED',
    "sessionDate" DATE,
    "sessionSlot" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvigilationDuty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_code_key" ON "Organization"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_domain_key" ON "Organization"("domain");

-- CreateIndex
CREATE INDEX "User_organizationId_role_idx" ON "User"("organizationId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "User_organizationId_email_key" ON "User"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Department_organizationId_code_key" ON "Department"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Course_departmentId_idx" ON "Course"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_organizationId_code_key" ON "Course"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_userId_key" ON "Teacher"("userId");

-- CreateIndex
CREATE INDEX "Teacher_organizationId_departmentId_idx" ON "Teacher"("organizationId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_organizationId_employeeId_key" ON "Teacher"("organizationId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE INDEX "Student_organizationId_departmentId_idx" ON "Student"("organizationId", "departmentId");

-- CreateIndex
CREATE INDEX "Student_organizationId_status_idx" ON "Student"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Student_organizationId_rollNumber_key" ON "Student"("organizationId", "rollNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Student_organizationId_registrationNumber_key" ON "Student"("organizationId", "registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Block_organizationId_code_key" ON "Block"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Room_blockId_idx" ON "Room"("blockId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_organizationId_name_key" ON "Room"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Bench_organizationId_idx" ON "Bench"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Bench_roomId_row_column_key" ON "Bench"("roomId", "row", "column");

-- CreateIndex
CREATE UNIQUE INDEX "Bench_roomId_number_key" ON "Bench"("roomId", "number");

-- CreateIndex
CREATE INDEX "Exam_organizationId_status_idx" ON "Exam"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Exam_organizationId_startDate_idx" ON "Exam"("organizationId", "startDate");

-- CreateIndex
CREATE INDEX "ExamSession_examId_examDate_idx" ON "ExamSession"("examId", "examDate");

-- CreateIndex
CREATE INDEX "SeatAllocation_organizationId_examId_idx" ON "SeatAllocation"("organizationId", "examId");

-- CreateIndex
CREATE INDEX "SeatAllocation_studentId_idx" ON "SeatAllocation"("studentId");

-- CreateIndex
CREATE INDEX "SeatAllocation_roomId_idx" ON "SeatAllocation"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "SeatAllocation_examId_studentId_key" ON "SeatAllocation"("examId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "SeatAllocation_examId_benchId_seatPosition_key" ON "SeatAllocation"("examId", "benchId", "seatPosition");

-- CreateIndex
CREATE INDEX "InvigilationDuty_organizationId_examId_idx" ON "InvigilationDuty"("organizationId", "examId");

-- CreateIndex
CREATE INDEX "InvigilationDuty_teacherId_idx" ON "InvigilationDuty"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "InvigilationDuty_examId_roomId_teacherId_key" ON "InvigilationDuty"("examId", "roomId", "teacherId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bench" ADD CONSTRAINT "Bench_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bench" ADD CONSTRAINT "Bench_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAllocation" ADD CONSTRAINT "SeatAllocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAllocation" ADD CONSTRAINT "SeatAllocation_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAllocation" ADD CONSTRAINT "SeatAllocation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAllocation" ADD CONSTRAINT "SeatAllocation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAllocation" ADD CONSTRAINT "SeatAllocation_benchId_fkey" FOREIGN KEY ("benchId") REFERENCES "Bench"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvigilationDuty" ADD CONSTRAINT "InvigilationDuty_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvigilationDuty" ADD CONSTRAINT "InvigilationDuty_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvigilationDuty" ADD CONSTRAINT "InvigilationDuty_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvigilationDuty" ADD CONSTRAINT "InvigilationDuty_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
