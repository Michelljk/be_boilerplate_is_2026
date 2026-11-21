-- H24/H25. Se mantiene el esquema fuera del schema.prisma por restricción de alcance.
CREATE TABLE "progress_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "member_id" UUID NOT NULL,
  "record_date" DATE NOT NULL,
  "weight_kg" DECIMAL(6,2) NOT NULL,
  "waist_cm" DECIMAL(6,2),
  "chest_cm" DECIMAL(6,2),
  "arm_cm" DECIMAL(6,2),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "progress_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "progress_records_member_fkey" FOREIGN KEY ("member_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "progress_records_member_date_key" UNIQUE ("member_id", "record_date"),
  CONSTRAINT "progress_records_values_check" CHECK ("weight_kg" BETWEEN 20 AND 300 AND ("waist_cm" IS NULL OR "waist_cm" BETWEEN 10 AND 250) AND ("chest_cm" IS NULL OR "chest_cm" BETWEEN 10 AND 250) AND ("arm_cm" IS NULL OR "arm_cm" BETWEEN 10 AND 250))
);
CREATE INDEX "progress_records_member_date_idx" ON "progress_records"("member_id", "record_date");
CREATE TABLE "exercise_marks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "progress_record_id" UUID NOT NULL,
  "exercise_id" UUID NOT NULL,
  "weight_kg" DECIMAL(6,2) NOT NULL,
  "reps" INTEGER NOT NULL,
  CONSTRAINT "exercise_marks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exercise_marks_record_fkey" FOREIGN KEY ("progress_record_id") REFERENCES "progress_records"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exercise_marks_exercise_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "exercise_marks_record_exercise_key" UNIQUE ("progress_record_id", "exercise_id"),
  CONSTRAINT "exercise_marks_values_check" CHECK ("weight_kg" BETWEEN 0 AND 500 AND "reps" BETWEEN 1 AND 100)
);
