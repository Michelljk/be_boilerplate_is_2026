-- H7 · Proyecto 2 GKDS
-- This is an empty migration.


-- Defensa adicional contra solapes, incluso ante procesos concurrentes.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE class_sessions ADD CONSTRAINT sessions_room_no_overlap
 EXCLUDE USING gist (room_id WITH =, tsrange(starts_at,ends_at,'[)') WITH &&) WHERE (status <> 'CANCELADA');
ALTER TABLE class_sessions ADD CONSTRAINT sessions_trainer_no_overlap
 EXCLUDE USING gist (trainer_id WITH =, tsrange(starts_at,ends_at,'[)') WITH &&) WHERE (status <> 'CANCELADA');
