import { describe, expect, it, vi } from 'vitest';
import {
  PaymentsRepository,
  replacementPaymentAmount,
} from './payments.repository.js';

const TODAY = '2026-11-18';

function createRepository() {
  const query = vi
    .fn()
    .mockResolvedValueOnce([{ n: 0 }])
    .mockResolvedValueOnce([]);
  const repository = new PaymentsRepository(
    { $queryRawUnsafe: query } as never,
    {
      today: () => TODAY,
      now: () => new Date(`${TODAY}T12:00:00.000Z`),
    } as never,
    {} as never,
  );
  return { query, repository };
}

describe('PaymentsRepository', () => {
  it('uses current canonical/provisional prices only for replacement payments', () => {
    expect(replacementPaymentAmount('MEMBRESIA', '125.50', '99.00')).toBe(
      '125.50',
    );
    expect(replacementPaymentAmount('SESION_PERSONAL', null, '8.00')).toBe(
      '10.00',
    );
    expect(replacementPaymentAmount('SESION_ADICIONAL', null, '8.00')).toBe(
      '15.00',
    );
  });

  it('rejects an existing pending payment as a conflict even without a receipt', async () => {
    const query = vi
      .fn()
      .mockResolvedValue([
        {
          id: '6fda2229-08ec-4bfa-a798-6ea4fdcf457b',
          status: 'PENDIENTE',
          number: null,
        },
      ]);
    const db = {
      $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
        work({ $queryRawUnsafe: query }),
    };
    const repository = new PaymentsRepository(
      db as never,
      {} as never,
      {} as never,
    );
    await expect(
      repository.void(
        '6fda2229-08ec-4bfa-a798-6ea4fdcf457b',
        '39122b59-a596-408c-8e19-4f343df1d63e',
        'Motivo de prueba de anulación',
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(query.mock.calls[0][0]).toContain('LEFT JOIN receipts');
    expect(query.mock.calls[0][0]).toContain('FOR UPDATE OF p');
  });

  it('returns not found for a genuinely nonexistent payment', async () => {
    const db = {
      $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
        work({ $queryRawUnsafe: vi.fn().mockResolvedValue([]) }),
    };
    const repository = new PaymentsRepository(
      db as never,
      {} as never,
      {} as never,
    );
    await expect(
      repository.void(
        '6fda2229-08ec-4bfa-a798-6ea4fdcf457b',
        '39122b59-a596-408c-8e19-4f343df1d63e',
        'Motivo de prueba de anulación',
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('returns bad request for a nonexistent payment selected for reception collection', async () => {
    const db = {
      $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
        work({ $queryRawUnsafe: vi.fn().mockResolvedValue([]) }),
    };
    const repository = new PaymentsRepository(
      db as never,
      {} as never,
      {} as never,
    );
    await expect(
      repository.collect(
        '6fda2229-08ec-4bfa-a798-6ea4fdcf457b',
        '39122b59-a596-408c-8e19-4f343df1d63e',
        { method: 'EFECTIVO' },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('accepts UUIDs containing hexadecimal letters in the version group', () => {
    const { repository } = createRepository();
    const validate = (value: string) =>
      (repository as unknown as { id(value: string): void }).id(value);
    expect(() =>
      validate('39122b59-a596-408c-8e19-4f343df1d63e'),
    ).not.toThrow();
    expect(() =>
      validate('6fda2229-08ec-4bfa-a798-6ea4fdcf457b'),
    ).not.toThrow();
    expect(() => validate('not-a-uuid')).toThrow();
  });

  it('lists pending payments without sending unused SQL parameters', async () => {
    const { query, repository } = createRepository();

    const result = await repository.pending({});

    expect(result).toEqual({ data: [], total: 0, page: 1, pageSize: 20 });
    expect(query.mock.calls[0]).toHaveLength(1);
    expect(query.mock.calls[1][1]).toBe(TODAY);
    expect(query.mock.calls[1]).toHaveLength(4);
  });

  it('keeps concept placeholders aligned when there is no overdue filter', async () => {
    const { query, repository } = createRepository();

    await repository.pending({ concept: 'MEMBRESIA' });

    expect(query.mock.calls[0][1]).toBe('MEMBRESIA');
    expect(query.mock.calls[0]).toHaveLength(2);
    expect(query.mock.calls[1].slice(1)).toEqual(['MEMBRESIA', TODAY, 20, 0]);
  });

  it('uses the overdue date parameter in both count and data queries', async () => {
    const { query, repository } = createRepository();

    await repository.pending({ overdue: 'NONE' });

    expect(query.mock.calls[0].slice(1)).toEqual([TODAY]);
    expect(query.mock.calls[1].slice(1)).toEqual([TODAY, 20, 0]);
  });

  it('orders H18 payments with null paidAt after dated payments', async () => {
    const { query, repository } = createRepository();

    await repository.history('member-id', {});

    expect(query.mock.calls[1][0]).toContain(
      'ORDER BY p.paid_at DESC NULLS LAST,p.id',
    );
  });
});
