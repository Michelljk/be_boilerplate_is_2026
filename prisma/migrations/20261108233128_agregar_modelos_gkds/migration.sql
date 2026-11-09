/*
  Warnings:

  - A unique constraint covering the columns `[member_number]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MIEMBRO', 'ENTRENADOR', 'RECEPCION_ADMIN');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('MONTHLY', 'QUARTERLY', 'BY_CLASSES');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('VIGENTE', 'VENCIDA');

-- CreateEnum
CREATE TYPE "MembershipOperation" AS ENUM ('COMPRA', 'RENOVACION');

-- CreateEnum
CREATE TYPE "MembershipRequestStatus" AS ENUM ('PENDIENTE_PAGO', 'APLICADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "PaymentConcept" AS ENUM ('MEMBRESIA', 'SESION_ADICIONAL', 'SESION_PERSONAL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDIENTE', 'PAGADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'TARJETA');

-- CreateEnum
CREATE TYPE "CheckInMembershipStatus" AS ENUM ('VIGENTE', 'VENCIDA', 'SIN_MEMBRESIA');

-- CreateEnum
CREATE TYPE "NotificationModule" AS ENUM ('MEMBRESIAS', 'RESERVAS', 'PAGOS', 'SISTEMA');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('NO_LEIDA', 'LEIDA');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "full_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "member_number" TEXT,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'MIEMBRO';

-- CreateTable
CREATE TABLE "MembershipPlan" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PlanType" NOT NULL,
    "price_usd" DECIMAL(10,2) NOT NULL,
    "duration_months" INTEGER,
    "duration_days" INTEGER,
    "class_credits" INTEGER,
    "benefits" JSONB NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "starts_on" TIMESTAMP(3) NOT NULL,
    "ends_on" TIMESTAMP(3) NOT NULL,
    "credits_remaining" INTEGER,
    "status" "MembershipStatus" NOT NULL DEFAULT 'VIGENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipRequest" (
    "id" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "membershipId" UUID,
    "planId" UUID NOT NULL,
    "paymentId" UUID,
    "operation" "MembershipOperation" NOT NULL,
    "status" "MembershipRequestStatus" NOT NULL DEFAULT 'PENDIENTE_PAGO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_at" TIMESTAMP(3),

    CONSTRAINT "MembershipRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "concept" "PaymentConcept" NOT NULL,
    "amount_usd" DECIMAL(10,2) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDIENTE',
    "method" "PaymentMethod",
    "card_last4" TEXT,
    "gateway_ref" TEXT,
    "paid_at" TIMESTAMP(3),
    "voided_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "voided_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "checked_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "check_in_date" TIMESTAMP(3) NOT NULL,
    "membership_status" "CheckInMembershipStatus" NOT NULL,
    "expired_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "registered_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "module" "NotificationModule" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "referenceId" UUID,
    "dedupe_key" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'NO_LEIDA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MembershipPlan_name_key" ON "MembershipPlan"("name");

-- CreateIndex
CREATE INDEX "Membership_memberId_status_idx" ON "Membership"("memberId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipRequest_paymentId_key" ON "MembershipRequest"("paymentId");

-- CreateIndex
CREATE INDEX "MembershipRequest_memberId_status_idx" ON "MembershipRequest"("memberId", "status");

-- CreateIndex
CREATE INDEX "Payment_status_due_date_idx" ON "Payment"("status", "due_date");

-- CreateIndex
CREATE INDEX "Payment_memberId_paid_at_idx" ON "Payment"("memberId", "paid_at");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_paymentId_key" ON "Receipt"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_number_key" ON "Receipt"("number");

-- CreateIndex
CREATE INDEX "CheckIn_check_in_date_idx" ON "CheckIn"("check_in_date");

-- CreateIndex
CREATE UNIQUE INDEX "CheckIn_memberId_check_in_date_key" ON "CheckIn"("memberId", "check_in_date");

-- CreateIndex
CREATE INDEX "Notification_memberId_status_created_at_idx" ON "Notification"("memberId", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_memberId_dedupe_key_key" ON "Notification"("memberId", "dedupe_key");

-- CreateIndex
CREATE UNIQUE INDEX "users_member_number_key" ON "users"("member_number");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRequest" ADD CONSTRAINT "MembershipRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRequest" ADD CONSTRAINT "MembershipRequest_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRequest" ADD CONSTRAINT "MembershipRequest_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRequest" ADD CONSTRAINT "MembershipRequest_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_registered_by_id_fkey" FOREIGN KEY ("registered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
