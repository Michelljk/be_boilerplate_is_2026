-- H36-H39: índices de apoyo para consultas read-only; no se materializan reportes.
CREATE INDEX IF NOT EXISTS payments_status_paid_at_idx ON payments (status, paid_at);
CREATE INDEX IF NOT EXISTS class_sessions_template_starts_at_idx ON class_sessions (class_template_id, starts_at);
CREATE INDEX IF NOT EXISTS memberships_ends_on_member_idx ON memberships (ends_on, member_id);
CREATE INDEX IF NOT EXISTS memberships_member_starts_on_idx ON memberships (member_id, starts_on);
