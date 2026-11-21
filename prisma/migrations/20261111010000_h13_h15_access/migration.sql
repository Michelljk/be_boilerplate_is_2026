-- H13-H15: registro auditable de un único ingreso por miembro y fecha local.
CREATE TYPE "CheckInMembershipStatus" AS ENUM ('VIGENTE', 'VENCIDA', 'SIN_MEMBRESIA');
CREATE TABLE "check_ins" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "member_id" UUID NOT NULL,
  "checked_in_at" TIMESTAMP(3) NOT NULL,
  "check_in_date" DATE NOT NULL,
  "membership_status" "CheckInMembershipStatus" NOT NULL,
  "expired_confirmed" BOOLEAN NOT NULL DEFAULT false,
  "registered_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "check_ins_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "check_ins_registered_by_id_fkey" FOREIGN KEY ("registered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "check_ins_exception_audit_check" CHECK ("membership_status" = 'VIGENTE' OR "expired_confirmed" = true)
);
CREATE UNIQUE INDEX "check_ins_member_id_check_in_date_key" ON "check_ins"("member_id", "check_in_date");
CREATE INDEX "check_ins_check_in_date_idx" ON "check_ins"("check_in_date");
CREATE INDEX "check_ins_checked_in_at_idx" ON "check_ins"("checked_in_at" DESC);
