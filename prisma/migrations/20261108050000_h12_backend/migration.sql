-- H12 · Proyecto 2 GKDS
-- CreateEnum
CREATE TYPE "PersonalSessionStatus" AS ENUM ('CONFIRMADA', 'CANCELADA', 'COMPLETADA');

-- CreateTable
CREATE TABLE "personal_sessions" (
    "id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "PersonalSessionStatus" NOT NULL DEFAULT 'CONFIRMADA',
    "attendance" "AttendanceStatus",
    "payment_id" UUID,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_id" UUID,
    "completed_at" TIMESTAMP(3),
    "marked_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personal_sessions_slot_id_key" ON "personal_sessions"("slot_id");

-- CreateIndex
CREATE INDEX "personal_sessions_member_id_starts_at_idx" ON "personal_sessions"("member_id", "starts_at");

-- CreateIndex
CREATE INDEX "personal_sessions_trainer_id_starts_at_idx" ON "personal_sessions"("trainer_id", "starts_at");

-- AddForeignKey
ALTER TABLE "personal_sessions" ADD CONSTRAINT "personal_sessions_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "trainer_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_sessions" ADD CONSTRAINT "personal_sessions_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_sessions" ADD CONSTRAINT "personal_sessions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_sessions" ADD CONSTRAINT "personal_sessions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_sessions" ADD CONSTRAINT "personal_sessions_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_sessions" ADD CONSTRAINT "personal_sessions_marked_by_id_fkey" FOREIGN KEY ("marked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE personal_sessions ADD CONSTRAINT personal_interval_valid CHECK (starts_at < ends_at);
ALTER TABLE personal_sessions ADD CONSTRAINT personal_completed_audit CHECK (status <> 'COMPLETADA' OR (completed_at IS NOT NULL AND marked_by_id IS NOT NULL AND attendance IN ('ASISTIO','NO_ASISTIO')));
