-- H9 · Proyecto 2 GKDS
-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('LIBRE', 'RESERVADO');

-- CreateTable
CREATE TABLE "trainer_slots" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "SlotStatus" NOT NULL DEFAULT 'LIBRE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainer_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trainer_slots_starts_at_status_idx" ON "trainer_slots"("starts_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "trainer_slots_trainer_id_starts_at_key" ON "trainer_slots"("trainer_id", "starts_at");

-- AddForeignKey
ALTER TABLE "trainer_slots" ADD CONSTRAINT "trainer_slots_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE trainer_slots ADD CONSTRAINT slots_duration_hour CHECK (ends_at = starts_at + INTERVAL '1 hour');
