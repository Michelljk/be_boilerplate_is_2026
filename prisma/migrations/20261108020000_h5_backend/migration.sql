-- H5 · Proyecto 2 GKDS
-- This is an empty migration.


ALTER TABLE memberships ADD CONSTRAINT memberships_credits_nonnegative CHECK (credits_remaining IS NULL OR credits_remaining >= 0);
ALTER TABLE class_reservations ADD CONSTRAINT reservations_credit_reference CHECK (NOT credit_consumed OR membership_id IS NOT NULL);
ALTER TABLE class_reservations ADD CONSTRAINT reservations_refund_consistent CHECK (NOT credit_refunded OR credit_consumed);
