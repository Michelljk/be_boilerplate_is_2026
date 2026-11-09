
import { describe, expect, it } from 'vitest';
import {
  validatePaymentVoid,
  type PaymentVoidInput,
} from './payment-void-validation.js';

const validVoid: PaymentVoidInput = {
  paymentId: 'aeba9980-c011-4483-bd9a-73ee6c67ebc3',
  status: 'PAGADO',
  reason: 'Cobro registrado por duplicado.',
  actorId: 'b6b5a24e-d9ab-4b3a-8b3c-e3d89a6ce348',
  actorRole: 'RECEPCION_ADMIN',
};

describe('H21 - Anulación de cobros', () => {
  it('permite preparar la anulación de un cobro realizado', () => {
    const result = validatePaymentVoid(validVoid);

    expect(result.previousStatus).toBe('PAGADO');
    expect(result.newStatus).toBe('ANULADO');
  });

  it('registra el responsable de la anulación', () => {
    const result = validatePaymentVoid(validVoid);

    expect(result.voidedBy).toBe(validVoid.actorId);
  });

  it('conserva el motivo de la anulación', () => {
    const result = validatePaymentVoid(validVoid);

    expect(result.reason).toBe('Cobro registrado por duplicado.');
  });

  it('rechaza pagos pendientes', () => {
    expect(() =>
      validatePaymentVoid({
        ...validVoid,
        status: 'PENDIENTE',
      }),
    ).toThrow();
  });

  it('impide anular nuevamente un pago anulado', () => {
    expect(() =>
      validatePaymentVoid({
        ...validVoid,
        status: 'ANULADO',
      }),
    ).toThrow();
  });

  it('rechaza motivos demasiado cortos', () => {
    expect(() =>
      validatePaymentVoid({
        ...validVoid,
        reason: 'Error',
      }),
    ).toThrow();
  });

  it('rechaza motivos vacíos', () => {
    expect(() =>
      validatePaymentVoid({
        ...validVoid,
        reason: '   ',
      }),
    ).toThrow();
  });

  it('rechaza usuarios sin permisos', () => {
    expect(() =>
      validatePaymentVoid({
        ...validVoid,
        actorRole: 'MIEMBRO',
      }),
    ).toThrow();
  });

  it('rechaza identificadores de pago inválidos', () => {
    expect(() =>
      validatePaymentVoid({
        ...validVoid,
        paymentId: 'incorrecto',
      }),
    ).toThrow();
  });

  it('rechaza identificadores de responsable inválidos', () => {
    expect(() =>
      validatePaymentVoid({
        ...validVoid,
        actorId: 'incorrecto',
      }),
    ).toThrow();
  });
});
