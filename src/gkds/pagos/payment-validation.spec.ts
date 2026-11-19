
import { describe, expect, it } from 'vitest';
import {
  validatePayment,
  simulateCardPayment,
  getNextPaymentStatus,
  type PaymentInput,
} from './payment-validation.js';

const pendingPayment: PaymentInput = {
  concept: 'MEMBRESIA',
  amountUsd: 30,
  status: 'PENDIENTE',
};

describe('H16 - Validación de pagos', () => {
  it('acepta un pago pendiente válido', () => {
    expect(() => validatePayment(pendingPayment)).not.toThrow();
  });

  it('acepta pagos de sesión adicional', () => {
    expect(() => validatePayment({
      ...pendingPayment,
      concept: 'SESION_ADICIONAL',
    })).not.toThrow();
  });

  it('rechaza montos negativos', () => {
    expect(() => validatePayment({
      ...pendingPayment,
      amountUsd: -10,
    })).toThrow();
  });

  it('rechaza pagos ya realizados', () => {
    expect(() => validatePayment({
      ...pendingPayment,
      status: 'PAGADO',
    })).toThrow();
  });

  it('aprueba la tarjeta de prueba 4242', () => {
    expect(simulateCardPayment('4242')).toBe('APPROVED');
  });

  it('rechaza la tarjeta de prueba 0002', () => {
    expect(simulateCardPayment('0002')).toBe('DECLINED');
  });

  it('convierte un pago aprobado a PAGADO', () => {
    expect(
      getNextPaymentStatus('PENDIENTE', 'APPROVED'),
    ).toBe('PAGADO');
  });

  it('conserva PENDIENTE cuando el pago es rechazado', () => {
    expect(
      getNextPaymentStatus('PENDIENTE', 'DECLINED'),
    ).toBe('PENDIENTE');
  });

  it('impide procesar nuevamente un pago realizado', () => {
    expect(() =>
      getNextPaymentStatus('PAGADO', 'APPROVED'),
    ).toThrow();
  });
});
