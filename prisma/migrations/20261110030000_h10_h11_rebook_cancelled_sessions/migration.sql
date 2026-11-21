-- H11 conserva la fila cancelada; H10 debe permitir crear otra sesión para el mismo slot.
DROP INDEX IF EXISTS "personal_sessions_slot_id_key";
CREATE INDEX IF NOT EXISTS "personal_sessions_slot_id_idx" ON "personal_sessions"("slot_id");
