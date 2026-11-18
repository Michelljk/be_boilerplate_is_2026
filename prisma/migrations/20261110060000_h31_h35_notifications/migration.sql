CREATE TYPE "NotificationModule" AS ENUM ('MEMBRESIAS', 'RESERVAS', 'PAGOS', 'SISTEMA');
CREATE TYPE "NotificationStatus" AS ENUM ('NO_LEIDA', 'LEIDA');
CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "member_id" UUID NOT NULL,
  "module" "NotificationModule" NOT NULL, "title" VARCHAR(100) NOT NULL, "message" VARCHAR(500) NOT NULL,
  "reference_id" UUID, "dedupe_key" VARCHAR(100), "status" "NotificationStatus" NOT NULL DEFAULT 'NO_LEIDA',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "read_at" TIMESTAMP(3),
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "notifications_member_dedupe_key_key" ON "notifications"("member_id", "dedupe_key") WHERE "dedupe_key" IS NOT NULL;
CREATE INDEX "notifications_member_created_idx" ON "notifications"("member_id", "created_at" DESC);
CREATE INDEX "notifications_member_unread_idx" ON "notifications"("member_id", "status") WHERE "status" = 'NO_LEIDA';

-- CreateTable
CREATE TABLE "domain_events" (
  "id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "aggregate_id" UUID NOT NULL,
  "recipient_id" UUID NOT NULL,
  "payload" JSONB NOT NULL,
  "dedupe_key" TEXT NOT NULL,
  "processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "domain_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "domain_events_dedupe_key_key" ON "domain_events"("dedupe_key");

CREATE INDEX "domain_events_processed_at_created_at_idx" ON "domain_events"("processed_at", "created_at");
