-- H4 · Proyecto 2 GKDS
-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('ACTIVA', 'INACTIVA');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PROGRAMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('CONFIRMADA', 'CANCELADA', 'CANCELADA_POR_GIMNASIO');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PENDIENTE', 'ASISTIO', 'NO_ASISTIO');

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "capacity" INTEGER NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_templates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "trainer_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "ClassStatus" NOT NULL DEFAULT 'ACTIVA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_sessions" (
    "id" UUID NOT NULL,
    "class_template_id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'PROGRAMADA',
    "cancel_reason" VARCHAR(250),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_reservations" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "membership_id" UUID,
    "credit_consumed" BOOLEAN NOT NULL DEFAULT false,
    "credit_refunded" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMADA',
    "attendance" "AttendanceStatus" NOT NULL DEFAULT 'PENDIENTE',
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rooms_name_key" ON "rooms"("name");

-- CreateIndex
CREATE INDEX "class_sessions_starts_at_status_idx" ON "class_sessions"("starts_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "class_sessions_class_template_id_starts_at_key" ON "class_sessions"("class_template_id", "starts_at");

-- CreateIndex
CREATE INDEX "class_reservations_member_id_status_idx" ON "class_reservations"("member_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "class_reservations_session_id_member_id_key" ON "class_reservations"("session_id", "member_id");

-- AddForeignKey
ALTER TABLE "class_templates" ADD CONSTRAINT "class_templates_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_templates" ADD CONSTRAINT "class_templates_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_class_template_id_fkey" FOREIGN KEY ("class_template_id") REFERENCES "class_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_reservations" ADD CONSTRAINT "class_reservations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_reservations" ADD CONSTRAINT "class_reservations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_reservations" ADD CONSTRAINT "class_reservations_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE rooms ADD CONSTRAINT rooms_capacity_positive CHECK (capacity > 0);
ALTER TABLE class_templates ADD CONSTRAINT templates_weekday_valid CHECK (weekday BETWEEN 1 AND 7);
ALTER TABLE class_templates ADD CONSTRAINT templates_capacity_valid CHECK (capacity BETWEEN 1 AND 50);
ALTER TABLE class_templates ADD CONSTRAINT templates_duration_valid CHECK (duration_minutes IN (30,45,60,75,90,120));
ALTER TABLE class_sessions ADD CONSTRAINT sessions_interval_valid CHECK (starts_at < ends_at);
ALTER TABLE class_sessions ADD CONSTRAINT sessions_capacity_valid CHECK (capacity BETWEEN 1 AND 50);
