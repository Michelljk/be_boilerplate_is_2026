
-- GKDS - H10 / H11
-- Permitir reutilizar horarios de sesiones canceladas.
-- Mantener una sola sesión no cancelada por horario.

DROP INDEX IF EXISTS "personal_sessions_slot_id_key";

CREATE UNIQUE INDEX "personal_sessions_active_slot_unique"
ON "personal_sessions" ("slot_id")
WHERE "status" <> 'CANCELADA';
