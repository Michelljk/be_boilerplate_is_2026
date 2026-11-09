-- H27 · Proyecto 2 GKDS
-- CreateEnum
CREATE TYPE "MachineStatus" AS ENUM ('DISPONIBLE', 'EN_MANTENIMIENTO', 'FUERA_SERVICIO');

-- CreateTable
CREATE TABLE "machines" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "location" VARCHAR(100) NOT NULL,
    "status" "MachineStatus" NOT NULL DEFAULT 'DISPONIBLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_maintenances" (
    "id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "reason" VARCHAR(250) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "closed_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machine_maintenances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_status_changes" (
    "id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "from_status" "MachineStatus" NOT NULL,
    "to_status" "MachineStatus" NOT NULL,
    "reason" VARCHAR(250) NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machine_status_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "machines_name_key" ON "machines"("name");

-- CreateIndex
CREATE INDEX "machines_status_location_idx" ON "machines"("status", "location");

-- CreateIndex
CREATE INDEX "machine_maintenances_machine_id_ended_at_idx" ON "machine_maintenances"("machine_id", "ended_at");

-- CreateIndex
CREATE INDEX "machine_status_changes_machine_id_changed_at_idx" ON "machine_status_changes"("machine_id", "changed_at");

-- AddForeignKey
ALTER TABLE "machine_maintenances" ADD CONSTRAINT "machine_maintenances_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_maintenances" ADD CONSTRAINT "machine_maintenances_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_maintenances" ADD CONSTRAINT "machine_maintenances_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_status_changes" ADD CONSTRAINT "machine_status_changes_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_status_changes" ADD CONSTRAINT "machine_status_changes_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE UNIQUE INDEX maintenance_one_open_per_machine ON machine_maintenances(machine_id) WHERE ended_at IS NULL;
ALTER TABLE machine_maintenances ADD CONSTRAINT maintenance_dates_valid CHECK (ended_at IS NULL OR ended_at >= started_at);
