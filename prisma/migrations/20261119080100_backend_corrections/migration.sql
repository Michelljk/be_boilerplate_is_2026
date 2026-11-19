-- Correcciones aditivas: no se reescriben las migraciones originales.
ALTER TABLE membership_requests ADD COLUMN previous_state JSONB;
-- Referencias huérfanas anteriores nunca deben aplicarse como compras nuevas.
UPDATE membership_requests mr SET membership_id = NULL, status = 'CANCELADA'
WHERE membership_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.id = mr.membership_id);
ALTER TABLE membership_requests ADD CONSTRAINT membership_requests_membership_fkey
  FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE membership_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  member_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  plan_id UUID NOT NULL REFERENCES membership_plans(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  payment_id UUID NOT NULL UNIQUE REFERENCES payments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  credits_granted INTEGER,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT membership_periods_interval_valid CHECK (starts_on <= ends_on),
  CONSTRAINT membership_periods_credits_valid CHECK (credits_granted IS NULL OR credits_granted >= 0)
);
CREATE INDEX membership_periods_member_id_starts_on_ends_on_idx ON membership_periods(member_id, starts_on, ends_on);
CREATE INDEX membership_periods_ends_on_idx ON membership_periods(ends_on);
-- Un historial previo no puede reconstruirse si ya se sobrescribió; se conserva
-- el periodo actualmente conocido y todos los nuevos pagos se registran aparte.
INSERT INTO membership_periods(membership_id,member_id,plan_id,payment_id,starts_on,ends_on,credits_granted,created_at)
SELECT m.id,m.member_id,m.plan_id,m.payment_id,m.starts_on,m.ends_on,mp.credits,COALESCE(p.paid_at,m.created_at)
FROM memberships m JOIN payments p ON p.id=m.payment_id
JOIN membership_plans mp ON mp.id=m.plan_id
WHERE p.status='PAGADO' AND p.concept='MEMBRESIA' AND p.member_id=m.member_id
ON CONFLICT (payment_id) DO NOTHING;

ALTER TABLE receipts ADD COLUMN created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- Solo la migración reconstruye la fecha conocida. Después se restaura el
-- trigger que impide editar/eliminar comprobantes por las operaciones normales.
ALTER TABLE receipts DISABLE TRIGGER USER;
UPDATE receipts SET created_at = issued_at;
ALTER TABLE receipts ENABLE TRIGGER USER;
INSERT INTO receipts(id,payment_id,number,method,issued_at,created_at)
SELECT gen_random_uuid(),p.id,nextval('receipt_number_seq'),COALESCE(p.method,'EFECTIVO'::"PaymentMethod"),COALESCE(p.paid_at,p.created_at),COALESCE(p.paid_at,p.created_at)
FROM payments p WHERE p.status='PAGADO'
  AND NOT EXISTS(SELECT 1 FROM receipts r WHERE r.payment_id=p.id)
ON CONFLICT (payment_id) DO NOTHING;

ALTER TABLE personal_sessions DROP CONSTRAINT personal_sessions_slot_id_fkey;
ALTER TABLE personal_sessions ALTER COLUMN slot_id DROP NOT NULL;
ALTER TABLE personal_sessions ADD CONSTRAINT personal_sessions_slot_id_fkey
  FOREIGN KEY(slot_id) REFERENCES trainer_slots(id) ON DELETE SET NULL ON UPDATE CASCADE;
