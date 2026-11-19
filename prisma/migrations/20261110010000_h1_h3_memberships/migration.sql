-- H1-H3: persistencia de solicitudes auditable y duración explícita de planes calendario.
ALTER TABLE "membership_plans" ADD COLUMN "duration_months" INTEGER;
UPDATE "membership_plans" SET "duration_months" = CASE "type" WHEN 'MONTHLY' THEN 1 WHEN 'QUARTERLY' THEN 3 ELSE NULL END;
ALTER TABLE "membership_plans" ADD CONSTRAINT "membership_plans_duration_valid" CHECK (
  ("type" = 'MONTHLY' AND "duration_months" = 1 AND "duration_days" IS NULL AND "credits" IS NULL) OR
  ("type" = 'QUARTERLY' AND "duration_months" = 3 AND "duration_days" IS NULL AND "credits" IS NULL) OR
  ("type" = 'BY_CLASSES' AND "duration_months" IS NULL AND "duration_days" >= 1 AND "credits" >= 1)
);
CREATE TABLE "membership_requests" (
  "id" UUID NOT NULL,
  "member_id" UUID NOT NULL,
  "membership_id" UUID,
  "plan_id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "operation" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDIENTE_PAGO',
  "expected_starts_on" DATE,
  "expected_ends_on" DATE,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "applied_at" TIMESTAMP(3),
  CONSTRAINT "membership_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "membership_requests_operation_valid" CHECK ("operation" IN ('COMPRA','RENOVACION')),
  CONSTRAINT "membership_requests_status_valid" CHECK ("status" IN ('PENDIENTE_PAGO','APLICADA','CANCELADA')),
  CONSTRAINT "membership_requests_payment_id_key" UNIQUE ("payment_id"),
  CONSTRAINT "membership_requests_payment_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "membership_requests_member_fkey" FOREIGN KEY ("member_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "membership_requests_plan_fkey" FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "membership_requests_creator_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "membership_requests_member_status_idx" ON "membership_requests"("member_id", "status");
