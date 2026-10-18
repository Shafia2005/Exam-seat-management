-- Per-paper seating and duties, exam-day attendance, password reset tokens,
-- audit log, notification log and institution settings.
--
-- Existing seat allocations and duties applied to a whole exam; they are copied
-- onto every paper (exam session) of that exam so nothing is lost.

-- CreateEnum
CREATE TYPE "ExamAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'LOGGED', 'FAILED');

-- DropIndex (replaced by per-session unique indexes below)
DROP INDEX "InvigilationDuty_examId_roomId_teacherId_key";
DROP INDEX "SeatAllocation_examId_benchId_seatPosition_key";
DROP INDEX "SeatAllocation_examId_studentId_key";

-- AlterTable: institution settings
ALTER TABLE "Organization" ADD COLUMN     "minAttendancePercent" INTEGER NOT NULL DEFAULT 75,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- ─── Move exam-level seating and duties onto papers ──────────────────────────

-- Exams with seating or duties but no papers get a placeholder paper on their start date.
INSERT INTO "ExamSession" ("id", "organizationId", "examId", "subjectName", "examDate", "startTime", "endTime", "durationMinutes", "maximumMarks", "passingMarks", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, e."organizationId", e."id", 'General paper', e."startDate", '09:00', '12:00', 180, 100, 40, NOW(), NOW()
FROM "Exam" e
WHERE NOT EXISTS (SELECT 1 FROM "ExamSession" s WHERE s."examId" = e."id")
  AND (EXISTS (SELECT 1 FROM "SeatAllocation" a WHERE a."examId" = e."id")
    OR EXISTS (SELECT 1 FROM "InvigilationDuty" d WHERE d."examId" = e."id"));

-- Seat allocations: one copy per paper.
ALTER TABLE "SeatAllocation" ADD COLUMN     "attendanceMarkedAt" TIMESTAMP(3),
ADD COLUMN     "attendanceMarkedById" TEXT,
ADD COLUMN     "attendanceStatus" "ExamAttendanceStatus",
ADD COLUMN     "sessionId" TEXT;

INSERT INTO "SeatAllocation" ("id", "organizationId", "examId", "sessionId", "studentId", "roomId", "benchId", "seatPosition", "seatLabel", "algorithm", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, a."organizationId", a."examId", s."id", a."studentId", a."roomId", a."benchId", a."seatPosition", a."seatLabel", a."algorithm", a."createdAt", NOW()
FROM "SeatAllocation" a
JOIN "ExamSession" s ON s."examId" = a."examId"
WHERE a."sessionId" IS NULL;

DELETE FROM "SeatAllocation" WHERE "sessionId" IS NULL;

ALTER TABLE "SeatAllocation" ALTER COLUMN "sessionId" SET NOT NULL;

-- Invigilation duties: one copy per paper.
ALTER TABLE "InvigilationDuty" ADD COLUMN     "sessionId" TEXT;

INSERT INTO "InvigilationDuty" ("id", "organizationId", "examId", "sessionId", "roomId", "teacherId", "role", "status", "notes", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, d."organizationId", d."examId", s."id", d."roomId", d."teacherId", d."role", d."status", d."notes", d."createdAt", NOW()
FROM "InvigilationDuty" d
JOIN "ExamSession" s ON s."examId" = d."examId"
WHERE d."sessionId" IS NULL;

DELETE FROM "InvigilationDuty" WHERE "sessionId" IS NULL;

-- Date and time now come from the paper.
ALTER TABLE "InvigilationDuty" DROP COLUMN "sessionDate",
DROP COLUMN "sessionSlot",
ALTER COLUMN "sessionId" SET NOT NULL;

-- ─── New tables ──────────────────────────────────────────────────────────────

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "recipientName" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL,
    "error" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- ─── Indexes & foreign keys ──────────────────────────────────────────────────

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_entityType_idx" ON "AuditLog"("organizationId", "entityType");

-- CreateIndex
CREATE INDEX "NotificationLog_organizationId_createdAt_idx" ON "NotificationLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "InvigilationDuty_sessionId_idx" ON "InvigilationDuty"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "InvigilationDuty_sessionId_roomId_teacherId_key" ON "InvigilationDuty"("sessionId", "roomId", "teacherId");

-- CreateIndex
CREATE INDEX "SeatAllocation_sessionId_roomId_idx" ON "SeatAllocation"("sessionId", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "SeatAllocation_sessionId_studentId_key" ON "SeatAllocation"("sessionId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "SeatAllocation_sessionId_benchId_seatPosition_key" ON "SeatAllocation"("sessionId", "benchId", "seatPosition");

-- AddForeignKey
ALTER TABLE "SeatAllocation" ADD CONSTRAINT "SeatAllocation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAllocation" ADD CONSTRAINT "SeatAllocation_attendanceMarkedById_fkey" FOREIGN KEY ("attendanceMarkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvigilationDuty" ADD CONSTRAINT "InvigilationDuty_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
