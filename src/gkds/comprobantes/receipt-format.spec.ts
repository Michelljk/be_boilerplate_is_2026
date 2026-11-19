
import { describe, expect, it } from 'vitest';
import {
  formatReceiptNumber,
  prepareReceipt,
  type ReceiptData,
} from './receipt-format.js';

const receipt: ReceiptData = {
  number: 15,
  memberName: 'Miembro de prueba',
  concept: 'MEMBRESIA',
  amountUsd: 30,
  status: 'PAGADO',
  issuedAt: new Date('2026-11-08T12:00:00Z'),
};

describe('H17 - Preparación de comprobantes', () => {
  it('genera un número de comprobante', () => {
    expect(formatReceiptNumber(15)).toBe('C-000015');
  });

  it('rechaza números de comprobante inválidos', () => {
    expect(() => formatReceiptNumber(0)).toThrow();
    expect(() => formatReceiptNumber(-1)).toThrow();
  });

  it('prepara un comprobante válido', () => {
    const result = prepareReceipt(receipt);

    expect(result.receiptNumber).toBe('C-000015');
    expect(result.status).toBe('PAGADO');
  });

  it('formatea el monto con dos decimales', () => {
    const result = prepareReceipt({
      ...receipt,
      amountUsd: 25.5,
    });

    expect(result.amount).toBe('USD 25.50');
  });

  it('rechaza miembros sin nombre', () => {
    expect(() =>
      prepareReceipt({ ...receipt, memberName: ' ' }),
    ).toThrow();
  });

  it('rechaza montos inválidos', () => {
    expect(() =>
      prepareReceipt({ ...receipt, amountUsd: -10 }),
    ).toThrow();
  });

  it('conserva el estado ANULADO', () => {
    const result = prepareReceipt({
      ...receipt,
      status: 'ANULADO',
    });

    expect(result.status).toBe('ANULADO');
  });

  it('registra la fecha de emisión', () => {
    const result = prepareReceipt(receipt);

    expect(result.issuedAt).toBe('2026-11-08T12:00:00.000Z');
  });
});
