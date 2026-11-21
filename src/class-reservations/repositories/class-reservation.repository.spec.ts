import { describe, expect, it, vi } from 'vitest';
import { ClassReservationRepository } from './class-reservation.repository.js';

const notice = {
  memberIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
  module: 'RESERVAS',
  title: 'Reserva confirmada',
  message: 'Reserva confirmada.',
  referenceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  dedupeKey: 'RES-CONF-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
};

function harness(send = vi.fn().mockResolvedValue({ created: 1, skipped: 0, ids: ['notice'] })) {
  const committed = { reservation: false, notification: false };
  const tx = {};
  const prisma = {
    $transaction: vi.fn(async (work: (client: object) => Promise<unknown>) => {
      // Simula commit/rollback: el estado sólo se considera persistido al resolver.
      const result = await work(tx);
      committed.reservation = true;
      committed.notification = true;
      return result;
    }),
  };
  const repo = new ClassReservationRepository(
    prisma as never,
    {} as never,
    { send } as never,
  );
  return { repo, send, tx, committed };
}

describe('ClassReservationRepository H33 transaction boundary', () => {
  it('inserta aviso con el tx que protege la reserva confirmada', async () => {
    const { repo, send, tx } = harness();
    vi.spyOn(repo as never, 'reserve').mockResolvedValue({
      result: { id: notice.referenceId },
      notice,
    } as never);

    await repo.create(notice.memberIds[0], 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', new Date(), '2026-11-19');

    expect(send).toHaveBeenCalledWith(notice, tx);
  });

  it('propaga el fallo H35 y la transacción de negocio hace rollback', async () => {
    const failure = new Error('falló la inserción H35');
    const send = vi.fn().mockRejectedValue(failure);
    const { repo, send: sendSpy, tx, committed } = harness(send);
    vi.spyOn(repo as never, 'reserve').mockResolvedValue({
      result: { id: notice.referenceId },
      notice,
    } as never);

    await expect(
      repo.create(notice.memberIds[0], 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', new Date(), '2026-11-19'),
    ).rejects.toBe(failure);
    expect(sendSpy).toHaveBeenCalledWith(notice, tx);
    expect(committed).toEqual({ reservation: false, notification: false });
  });

  it('si el negocio rechaza una reserva llena, no invoca H35', async () => {
    const { repo, send } = harness();
    const rejected = new Error('cupo lleno');
    vi.spyOn(repo as never, 'reserve').mockRejectedValue(rejected);

    await expect(
      repo.create(notice.memberIds[0], 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', new Date(), '2026-11-19'),
    ).rejects.toBe(rejected);
    expect(send).not.toHaveBeenCalled();
  });

  it('usa tx común para el aviso de cancelación propia', async () => {
    const { repo, send, tx } = harness();
    vi.spyOn(repo as never, 'cancelOwned').mockResolvedValue({
      result: { id: notice.referenceId },
      notice: { ...notice, dedupeKey: 'RES-CANCEL-' + notice.referenceId },
    } as never);

    await repo.cancelOwn(notice.referenceId, notice.memberIds[0], new Date());

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      memberIds: notice.memberIds,
      dedupeKey: 'RES-CANCEL-' + notice.referenceId,
    }), tx);
  });
});
