import { describe, it, expect, vi } from 'vitest';
import { serializable } from './serializable.js';
import { DomainError } from '../errors/domain.error.js';
import type { PrismaService } from '../../prisma/services/prisma.service.js';

function database(transaction: ReturnType<typeof vi.fn>): PrismaService {
  return { $transaction: transaction } as unknown as PrismaService;
}

describe('serializable: regresiones de errores HTTP 500', () => {
  it('reintenta un SQLSTATE 40001 envuelto por el adapter P2010', async () => {
    const tx = vi
      .fn()
      .mockRejectedValueOnce({
        code: 'P2010',
        meta: { driverAdapterError: { cause: { originalCode: '40001' } } },
      })
      .mockResolvedValue('confirmado');
    expect(await serializable(database(tx), async () => 'confirmado')).toBe(
      'confirmado',
    );
    expect(tx).toHaveBeenCalledTimes(2);
  });
  it('reintenta un conflicto P2039 TransactionWriteConflict', async () => {
    const tx = vi
      .fn()
      .mockRejectedValueOnce({
        code: 'P2039',
        meta: {
          driverAdapterError: { cause: { kind: 'TransactionWriteConflict' } },
        },
      })
      .mockResolvedValue(1);
    expect(await serializable(database(tx), async () => 1)).toBe(1);
    expect(tx).toHaveBeenCalledTimes(2);
  });
  it('reintenta deadlock abortado sin repetir una confirmación', async () => {
    const tx = vi
      .fn()
      .mockRejectedValueOnce({ code: '40P01' })
      .mockResolvedValue(3);
    expect(await serializable(database(tx), async () => 3)).toBe(3);
    expect(tx).toHaveBeenCalledTimes(2);
  });
  it('traduce exclusión de horario a conflicto del contrato H7', async () => {
    const tx = vi
      .fn()
      .mockRejectedValue({ code: 'P2010', meta: { code: '23P01' } });
    await expect(
      serializable(database(tx), async () => 1),
    ).rejects.toMatchObject({
      kind: 'CONFLICT',
      message: 'Existe un conflicto de horario',
    });
    expect(tx).toHaveBeenCalledTimes(1);
  });
  it('traduce CHECK de datos a error controlado, no 500', async () => {
    const tx = vi
      .fn()
      .mockRejectedValue({ code: 'P2010', meta: { code: '23514' } });
    await expect(
      serializable(database(tx), async () => 1),
    ).rejects.toMatchObject({ kind: 'INVALID' });
    expect(tx).toHaveBeenCalledTimes(1);
  });
  it('tras agotar abortos devuelve conflicto y no confirma dos veces', async () => {
    const tx = vi.fn().mockRejectedValue({ code: 'P2034' });
    await expect(
      serializable(database(tx), async () => 1),
    ).rejects.toMatchObject({ kind: 'CONFLICT' });
    expect(tx).toHaveBeenCalledTimes(5);
  });
  it('no reintenta una transacción confirmada', async () => {
    const tx = vi.fn().mockResolvedValue(1);
    expect(await serializable(database(tx), async () => 1)).toBe(1);
    expect(tx).toHaveBeenCalledTimes(1);
  });
  it('no oculta errores de programación ni errores de dominio', async () => {
    const error = new Error('programación');
    const tx = vi.fn().mockRejectedValue(error);
    await expect(serializable(database(tx), async () => 1)).rejects.toBe(error);
    expect(tx).toHaveBeenCalledTimes(1);
    const domain = new DomainError('CONFLICT', 'Ya reservado');
    const other = vi.fn().mockRejectedValue(domain);
    await expect(serializable(database(other), async () => 1)).rejects.toBe(
      domain,
    );
    expect(other).toHaveBeenCalledTimes(1);
  });
});
