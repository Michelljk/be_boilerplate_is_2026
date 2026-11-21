-- H16-H21: comprobantes inmutables y trazabilidad de anulaciones.
CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START WITH 1 INCREMENT BY 1;
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL UNIQUE REFERENCES payments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  number BIGINT NOT NULL UNIQUE DEFAULT nextval('receipt_number_seq'),
  method "PaymentMethod" NOT NULL,
  issued_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS voided_by_id UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS payments_status_due_date_idx ON payments(status,due_date);
CREATE INDEX IF NOT EXISTS payments_member_paid_at_idx ON payments(member_id,paid_at DESC,id);
CREATE INDEX IF NOT EXISTS receipts_number_idx ON receipts(number);
-- No UPDATE/DELETE path is exposed by this module; enforce receipt immutability at DB level.
CREATE OR REPLACE FUNCTION reject_receipt_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Receipts are immutable'; END;
$$;
DROP TRIGGER IF EXISTS receipts_immutable_trigger ON receipts;
CREATE TRIGGER receipts_immutable_trigger BEFORE UPDATE OR DELETE ON receipts FOR EACH ROW EXECUTE FUNCTION reject_receipt_mutation();
