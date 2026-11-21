-- H22 · Proyecto 2 GKDS
-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVA', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "RoutineStatus" AS ENUM ('VIGENTE', 'REEMPLAZADA', 'FINALIZADA');

-- CreateTable
CREATE TABLE "trainer_member_assignments" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVA',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainer_member_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "muscle_group" VARCHAR(60) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_routines" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "goal" VARCHAR(250) NOT NULL,
    "version" INTEGER NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RoutineStatus" NOT NULL DEFAULT 'VIGENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_routines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_exercises" (
    "id" UUID NOT NULL,
    "routine_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "routine_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trainer_member_assignments_trainer_id_status_idx" ON "trainer_member_assignments"("trainer_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "exercises_name_key" ON "exercises"("name");

-- CreateIndex
CREATE INDEX "training_routines_member_id_status_idx" ON "training_routines"("member_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "training_routines_member_id_version_key" ON "training_routines"("member_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "routine_exercises_routine_id_weekday_position_key" ON "routine_exercises"("routine_id", "weekday", "position");

-- AddForeignKey
ALTER TABLE "trainer_member_assignments" ADD CONSTRAINT "trainer_member_assignments_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_member_assignments" ADD CONSTRAINT "trainer_member_assignments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_routines" ADD CONSTRAINT "training_routines_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_routines" ADD CONSTRAINT "training_routines_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_exercises" ADD CONSTRAINT "routine_exercises_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "training_routines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_exercises" ADD CONSTRAINT "routine_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE UNIQUE INDEX assignments_one_active_per_member ON trainer_member_assignments(member_id) WHERE status='ACTIVA';
CREATE UNIQUE INDEX routines_one_current_per_member ON training_routines(member_id) WHERE status='VIGENTE';
ALTER TABLE training_routines ADD CONSTRAINT routine_dates_valid CHECK (starts_on <= ends_on);
ALTER TABLE routine_exercises ADD CONSTRAINT exercise_ranges_valid CHECK (weekday BETWEEN 1 AND 7 AND sets BETWEEN 1 AND 10 AND reps BETWEEN 1 AND 100 AND position BETWEEN 1 AND 50);
