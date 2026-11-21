-- H29/H30: una única reseña por miembro y sesión grupal.
CREATE TABLE "reviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL,
  "member_id" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "reviews_member_session_key" UNIQUE ("member_id", "session_id"),
  CONSTRAINT "reviews_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reviews_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "reviews_session_id_idx" ON "reviews"("session_id");
CREATE INDEX "reviews_member_id_created_at_idx" ON "reviews"("member_id", "created_at" DESC);
