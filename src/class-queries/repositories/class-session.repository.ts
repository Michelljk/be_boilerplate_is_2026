import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { Prisma, ReservationStatus, SessionStatus } from '@PrismaClient';
import { DomainError } from '@Common/errors';

export interface ClassSessionSearch {
  from: Date;
  toExclusive: Date;
  name?: string;
  roomId?: string;
  trainerId?: string;
  skip: number;
  take: number;
}

export interface ClassSessionListingRow {
  id: string;
  classTemplateId: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  status: SessionStatus;
  className: string;
  trainerName: string;
  roomName: string;
  confirmedCount: number;
}

export interface ClassSessionSnapshot {
  rows: ClassSessionListingRow[];
  total: number;
}

@Injectable()
export class ClassSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAvailableSnapshot(
    query: ClassSessionSearch,
  ): Promise<ClassSessionSnapshot> {
    const where: Prisma.ClassSessionWhereInput = {
      startsAt: { gte: query.from, lt: query.toExclusive },
      status: { not: SessionStatus.CANCELADA },
      ...(query.name
        ? {
            classTemplate: {
              name: { contains: query.name, mode: 'insensitive' },
            },
          }
        : {}),
      ...(query.roomId ? { roomId: query.roomId } : {}),
      ...(query.trainerId ? { trainerId: query.trainerId } : {}),
    };

    return this.prisma.$transaction(
      async (tx) => {
        const [sessions, total] = await Promise.all([
          tx.classSession.findMany({
            where,
            orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
            skip: query.skip,
            take: query.take,
            select: {
              id: true,
              classTemplateId: true,
              startsAt: true,
              endsAt: true,
              capacity: true,
              status: true,
              classTemplate: { select: { name: true } },
              trainer: { select: { profile: { select: { fullName: true } } } },
              room: { select: { name: true } },
              _count: {
                select: {
                  reservations: {
                    where: { status: ReservationStatus.CONFIRMADA },
                  },
                },
              },
            },
          }),
          tx.classSession.count({ where }),
        ]);

        const rows: ClassSessionListingRow[] = sessions.map((session) => {
          const trainerName = session.trainer.profile?.fullName;
          if (!trainerName) {
            throw new DomainError(
              'INVALID',
              'La sesión tiene datos del entrenador incompletos.',
            );
          }

          return {
            id: session.id,
            classTemplateId: session.classTemplateId,
            startsAt: session.startsAt,
            endsAt: session.endsAt,
            capacity: session.capacity,
            status: session.status,
            className: session.classTemplate.name,
            trainerName,
            roomName: session.room.name,
            confirmedCount: session._count.reservations,
          };
        });

        return { rows, total };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
