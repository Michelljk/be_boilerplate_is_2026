
import { describe, expect, it } from 'vitest';
import {
  validateCollection,
  type CollectionInput,
} from './collect-payment.js';

const payment: CollectionInput = {
  paymentId: 'aeba9980-c011-4483-bd9a-73ee6c67ebc3',
  status: 'PENDIENTE',
  amountUsd: 30,
  method: 'EFECTIVO',
};

describe('H19 - Cobros en recepción', () => {
  it('permite cobrar en efectivo', () => {
    const result = validateCollection(payment);

    expect(result.status).toBe('PAGADO');
    expect(result.method).toBe('EFECTIVO');
    expect(result.cardLast4).toBeNull();
  });

  it('formatea el monto con dos decimales', () => {
    const result = validateCollection({
      ...payment,
      amountUsd: 25.5,
    });

    expect(result.amountUsd).toBe('25.50');
  });

  it('acepta una tarjeta simulada aprobada', () => {
    const result = validateCollection({
      ...payment,
      method: 'TARJETA',
      cardLast4: '4242',
    });

    expect(result.cardLast4).toBe('4242');
  });

  it('rechaza una tarjeta simulada no aprobada', () => {
    expect(() =>
      validateCollection({
        ...payment,
        method: 'TARJETA',
        cardLast4: '0002',
      }),
    ).toThrow('Pago simulado rechazado.');
  });

  it('requiere cuatro dígitos para tarjeta', () => {
    expect(() =>
      validateCollection({
        ...payment,
        method: 'TARJETA',
      }),
    ).toThrow();
  });

  it('rechaza pagos ya realizados', () => {
    expect(() =>
      validateCollection({
        ...payment,
        status: 'PAGADO',
      }),
    ).toThrow();
  });

  it('rechaza pagos anulados', () => {
    expect(() =>
      validateCollection({
        ...payment,
        status: 'ANULADO',
      }),
    ).toThrow();
  });

  it('rechaza identificadores inválidos', () => {
    expect(() =>
      validateCollection({
        ...payment,
        paymentId: 'incorrecto',
      }),
    ).toThrow();
  });

  it('rechaza montos negativos', () => {
    expect(() =>
      validateCollection({
        ...payment,
        amountUsd: -15,
      }),
    ).toThrow();
  });
});
