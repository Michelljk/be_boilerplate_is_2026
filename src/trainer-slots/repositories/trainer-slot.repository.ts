import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { DomainError } from '@Common/errors';
import { serializable } from '@Common/repositories';
import { Prisma, type SlotStatus, type TrainerSlot } from '@PrismaClient';

const DUPLICATE_SLOT_MESSAGE = 'Ya tienes un espacio en ese horario';
const RESERVED_SLOT_MESSAGE = 'El espacio tiene una sesión confirmada';

export interface TrainerSlotSnapshot {
  slots: TrainerSlot[];
  total: number;
}

interface LockedTrainerSlotRow {
  id: string;
  trainerId: string;
  status: SlotStatus;
  hasPersonalSession: boolean;
}

@Injectable()
export class TrainerSlotRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    trainerId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<TrainerSlot> {
    return serializable(this.prisma, async (tx) => {
      try {
        return await tx.trainerSlot.create({
          data: { trainerId, startsAt, endsAt, status: 'LIBRE' },
        });
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          throw new DomainError('CONFLICT', DUPLICATE_SLOT_MESSAGE);
        }
        throw error;
      }
    });
  }

  async listByTrainer(
    trainerId: string,
    from: Date,
    toExclusive?: Date,
  ): Promise<TrainerSlotSnapshot> {
    return serializable(this.prisma, async (tx) => {
      const where = {
        trainerId,
        startsAt: {
          gte: from,
          ...(toExclusive ? { lt: toExclusive } : {}),
        },
      };
      const [slots, total] = await Promise.all([
        tx.trainerSlot.findMany({
          where,
          orderBy: { startsAt: 'asc' },
        }),
        tx.trainerSlot.count({ where }),
      ]);
      return { slots, total };
    });
  }

  async updateOwnedFree(
    id: string,
    trainerId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<TrainerSlot> {
    return serializable(this.prisma, async (tx) => {
      const row = await this.lockSlot(tx, id);
      this.assertOwnedAndFree(row, trainerId);
      try {
        return await tx.trainerSlot.update({
          where: { id },
          data: { startsAt, endsAt },
        });
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          throw new DomainError('CONFLICT', DUPLICATE_SLOT_MESSAGE);
        }
        throw error;
      }
    });
  }

  async deleteOwnedFree(id: string, trainerId: string): Promise<void> {
    await serializable(this.prisma, async (tx) => {
      const row = await this.lockSlot(tx, id);
      this.assertOwnedAndFree(row, trainerId);
      if (row.hasPersonalSession) {
        throw new DomainError(
          'CONFLICT',
          'El espacio tiene una sesión histórica asociada',
        );
      }
      await tx.trainerSlot.delete({ where: { id } });
      return undefined;
    });
  }

  private async lockSlot(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<LockedTrainerSlotRow> {
    const rows = await tx.$queryRaw<LockedTrainerSlotRow[]>(Prisma.sql`
      SELECT
        ts."id"::text AS "id",
        ts."trainer_id"::text AS "trainerId",
        ts."status"::text AS "status",
        EXISTS (
          SELECT 1
          FROM "personal_sessions" ps
          WHERE ps."slot_id" = ts."id"
        ) AS "hasPersonalSession"
      FROM "trainer_slots" ts
      WHERE ts."id" = ${id}::uuid
      FOR UPDATE
    `);
    const row = rows[0];
    if (!row) throw new DomainError('NOT_FOUND', 'Recurso no encontrado.');
    return row;
  }

  private assertOwnedAndFree(
    row: LockedTrainerSlotRow,
    trainerId: string,
  ): void {
    if (row.trainerId !== trainerId) {
      throw new DomainError('NOT_FOUND', 'Recurso no encontrado.');
    }
    if (row.status !== 'LIBRE') {
      throw new DomainError('CONFLICT', RESERVED_SLOT_MESSAGE);
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
