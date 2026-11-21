-- H10/H11 conservan la fila cancelada y permiten reagendar el mismo horario,
-- pero un horario no puede alojar dos sesiones CONFIRMADAS a la vez.
-- Se restaura la integridad con un índice único parcial (las canceladas conviven)
-- y se mantiene el índice no único para las consultas por slot en cualquier estado.
CREATE UNIQUE INDEX "personal_sessions_slot_id_key" ON "personal_sessions"("slot_id") WHERE ("status" = 'CONFIRMADA'::"PersonalSessionStatus");

CREATE INDEX IF NOT EXISTS "personal_sessions_slot_id_idx"
  ON "personal_sessions"("slot_id");
