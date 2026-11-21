import { describe, expect, it, vi } from 'vitest';
import { TrainerSlotRepository } from './trainer-slot.repository.js';

describe('TrainerSlotRepository', () => {
  it('elimina un slot LIBRE aunque conserve sesiones personales históricas', async () => {
    const deleteSlot = vi.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: 'slot-id',
          trainerId: 'trainer-id',
          status: 'LIBRE',
        },
      ]),
      trainerSlot: { delete: deleteSlot },
    };
    const prisma = {
      $transaction: vi.fn(async (work: (client: typeof tx) => unknown) =>
        work(tx),
      ),
    };

    await new TrainerSlotRepository(prisma as never).deleteOwnedFree(
      'slot-id',
      'trainer-id',
    );

    expect(deleteSlot).toHaveBeenCalledWith({ where: { id: 'slot-id' } });
  });
});
