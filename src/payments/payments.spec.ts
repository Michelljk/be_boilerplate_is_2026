import { describe, expect, it } from 'vitest';
import { validatePayment } from '../gkds/pagos/payment-validation.js';
import { isH16TestCardApproved } from './payment-card-simulation.js';
import { validateH16Card } from './payment-card-simulation.js';
import { validateCollection } from '../gkds/recepcion/collect-payment.js';
import { prepareReceipt } from '../gkds/comprobantes/receipt-format.js';
import { validatePaymentVoid } from '../gkds/anulaciones/payment-void-validation.js';
import { replacementPaymentAmount } from './repositories/payments.repository.js';

describe('Payments H16-H21 domain integrations', () => {
  it('follows H16 simulated card table: only a 16-digit number ending in 1234 is approved', () => {
    expect(isH16TestCardApproved('4111111111111234')).toBe(true);
    expect(isH16TestCardApproved('4111111111114242')).toBe(false);
    expect(isH16TestCardApproved('1234')).toBe(false);
  });
  it('requires all four H16 card fields before simulation', () => {
    expect(() =>
      validateH16Card({
        cardNumber: '4111111111111234',
        holder: 'Miembro',
        expiry: '12/28',
      }),
    ).toThrow();
    expect(
      validateH16Card({
        cardNumber: '4111111111111234',
        holder: 'Miembro',
        expiry: '12/28',
        cvv: '123',
      }).cardNumber,
    ).toBe('4111111111111234');
  });
  it('requires server-owned pending payment and amount for reception collection', () => {
    expect(() =>
      validateCollection({
        paymentId: 'aeba9980-c011-4483-bd9a-73ee6c67ebc3',
        status: 'PAGADO',
        amountUsd: 10,
        method: 'EFECTIVO',
      }),
    ).toThrow();
  });
  it('prepares stable receipt metadata without altering status', () => {
    expect(
      prepareReceipt({
        number: 1,
        memberName: 'Miembro',
        concept: 'MEMBRESIA',
        amountUsd: 15,
        status: 'ANULADO',
        issuedAt: new Date('2026-01-01Z'),
      }).status,
    ).toBe('ANULADO');
  });
  it('enforces void reason and admin role through shared validator', () => {
    expect(() =>
      validatePaymentVoid({
        paymentId: 'aeba9980-c011-4483-bd9a-73ee6c67ebc3',
        status: 'PAGADO',
        reason: 'incorrecto',
        actorId: 'b6b5a24e-d9ab-4b3a-8b3c-e3d89a6ce348',
        actorRole: 'MIEMBRO',
      }),
    ).toThrow();
  });
  it('rejects zero-value payments', () => {
    expect(() =>
      validatePayment({
        concept: 'MEMBRESIA',
        amountUsd: 0,
        status: 'PENDIENTE',
      }),
    ).toThrow();
  });

  it('uses the current plan price when replacing a membership payment', () => {
    expect(replacementPaymentAmount('MEMBRESIA', '125.50', '99.00')).toBe(
      '125.50',
    );
  });

  it('uses the canonical personal-session tariff when replacing a payment', () => {
    expect(replacementPaymentAmount('SESION_PERSONAL', null, '8.00')).toBe(
      '10.00',
    );
  });

  it('uses the provisional USD 15 tariff for replacement additional sessions', () => {
    expect(replacementPaymentAmount('SESION_ADICIONAL', null, '17.25')).toBe(
      '15.00',
    );
  });
});
