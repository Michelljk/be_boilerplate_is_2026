-- H6/H8: auditoría de cancelación propia, registro de asistencia y cierre de sesión.
ALTER TABLE class_reservations
  ADD COLUMN cancelled_by_id UUID,
  ADD COLUMN attendance_updated_at TIMESTAMP(3),
  ADD COLUMN attendance_updated_by_id UUID;
ALTER TABLE class_sessions
  ADD COLUMN completed_at TIMESTAMP(3),
  ADD COLUMN completed_by_id UUID;
ALTER TABLE class_reservations
  ADD CONSTRAINT class_reservations_cancelled_by_id_fkey FOREIGN KEY (cancelled_by_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT class_reservations_attendance_updated_by_id_fkey FOREIGN KEY (attendance_updated_by_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE class_sessions
  ADD CONSTRAINT class_sessions_completed_by_id_fkey FOREIGN KEY (completed_by_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX class_reservations_session_id_status_idx ON class_reservations(session_id, status);
