-- H8 - Registro de asistencia a sesiones grupales
-- Agrega auditoria del cierre de sesiones.

-- Las columnas completed_at/completed_by_id y la FK ya son creadas por
-- 20261110000000_h6_h8_group_attendance; aquí solo se agrega la nueva regla.

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
