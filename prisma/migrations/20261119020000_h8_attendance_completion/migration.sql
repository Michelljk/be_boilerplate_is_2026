
-- H8 - Registro de asistencia a sesiones grupales
-- Agrega auditoria del cierre de sesiones.

ALTER TABLE "class_sessions"
ADD COLUMN "completed_at" TIMESTAMP(3),
ADD COLUMN "completed_by_id" UUID;

ALTER TABLE "class_sessions"
ADD CONSTRAINT "class_sessions_completed_by_id_fkey"
FOREIGN KEY ("completed_by_id")
REFERENCES "users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Una sesion completada debe conservar
-- la fecha y el responsable de su cierre.

ALTER TABLE "class_sessions"
ADD CONSTRAINT "class_sessions_completion_audit"
CHECK (
    "status" <> 'COMPLETADA'
    OR (
        "completed_at" IS NOT NULL
        AND "completed_by_id" IS NOT NULL
    )
);
