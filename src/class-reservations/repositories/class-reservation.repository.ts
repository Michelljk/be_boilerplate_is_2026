import { Injectable } from '@nestjs/common';
import { Prisma, ReservationStatus, SessionStatus } from '@PrismaClient';
import { DomainError } from '@Common/errors';
import { serializable } from '@Common/repositories';
import { isCalendarDate } from '@Common/time';
import { PrismaService } from '@Prisma/services';
import { eligibleMembership } from '../../memberships/repositories/eligible-membership.js';
import type {
  ClassReservationSnapshot,
  CreatedClassReservation,
  ListedClassReservation,
} from './class-reservation.repository.types.js';

export interface ClassReservationListOptions {
  status?: ReservationStatus;
  skip: number;
  take: number;
}

interface LockedSession {
  id: string;
}

/** Único punto de H5 que conoce Prisma y sus relaciones. */
@Injectable()
export class ClassReservationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    memberId: string,
    sessionId: string,
    now: Date,
    today: string,
  ): Promise<CreatedClassReservation> {
    return serializable(this.prisma, async (tx) => {
      if (!isCalendarDate(today)) {
        throw new DomainError(
          'INVALID',
          'La fecha civil del gimnasio no es válida.',
        );
      }

      await tx.$queryRaw<LockedSession[]>`
        SELECT id FROM "users"
        WHERE id = ${memberId}::uuid
        FOR UPDATE
      `;

      await tx.$queryRaw<LockedSession[]>`
        SELECT id FROM "class_sessions"
        WHERE id = ${sessionId}::uuid
        FOR UPDATE
      `;

      const session = await tx.classSession.findUnique({
        where: { id: sessionId },
        include: {
          classTemplate: { select: { name: true } },
          room: { select: { name: true } },
        },
      });
      if (!session) throw new DomainError('NOT_FOUND', 'La sesión no existe.');
      if (session.status === SessionStatus.CANCELADA) {
        throw new DomainError('CONFLICT', 'La sesión está cancelada.');
      }
      if (session.status !== SessionStatus.PROGRAMADA) {
        throw new DomainError(
          'CONFLICT',
          'La sesión no admite reservas en este estado.',
        );
      }
      if (session.startsAt.getTime() <= now.getTime()) {
        throw new DomainError('CONFLICT', 'La sesión ya comenzó.');
      }

      const membership = await eligibleMembership(tx, memberId, today);
      await tx.$queryRaw<LockedSession[]>`
        SELECT id FROM "memberships"
        WHERE id = ${membership.id}::uuid
        FOR UPDATE
      `;

      const existing = await tx.classReservation.findUnique({
        where: { sessionId_memberId: { sessionId, memberId } },
      });
      if (existing) {
        if (existing.status === ReservationStatus.CONFIRMADA) {
          throw new DomainError(
            'CONFLICT',
            'Ya tienes una reserva para esta sesión',
          );
        }
        throw new DomainError(
          'CONFLICT',
          'Ya existe una reserva cancelada para esta sesión y no puede reactivarse.',
        );
      }

      const overlap = await tx.classReservation.findFirst({
        where: {
          memberId,
          status: ReservationStatus.CONFIRMADA,
          session: {
            startsAt: { lt: session.endsAt },
            endsAt: { gt: session.startsAt },
          },
        },
        select: { id: true },
      });
      if (overlap) {
        throw new DomainError(
          'CONFLICT',
          'La sesión se solapa con otra reserva confirmada.',
        );
      }

      const confirmedCount = await tx.classReservation.count({
        where: { sessionId, status: ReservationStatus.CONFIRMADA },
      });
      if (confirmedCount >= Math.max(0, session.capacity)) {
        throw new DomainError(
          'CONFLICT',
          'La sesión no tiene plazas disponibles.',
        );
      }

      const consumesCredit = membership.plan.type === 'BY_CLASSES';
      if (consumesCredit) {
        const creditUpdate = await tx.membership.updateMany({
          where: { id: membership.id, creditsRemaining: { gt: 0 } },
          data: { creditsRemaining: { decrement: 1 } },
        });
        if (creditUpdate.count !== 1) {
          throw new DomainError(
            'CONFLICT',
            'No tienes clases restantes para reservar.',
          );
        }
      }

      const reservation = await tx.classReservation.create({
        data: {
          sessionId,
          memberId,
          membershipId: consumesCredit ? membership.id : null,
          creditConsumed: consumesCredit,
          creditRefunded: false,
          status: ReservationStatus.CONFIRMADA,
          attendance: 'PENDIENTE',
        },
        select: {
          id: true,
          sessionId: true,
          status: true,
          createdAt: true,
        },
      });

      await tx.domainEvent.create({
        data: {
          type: 'CLASS_RESERVATION_CONFIRMED',
          aggregateId: reservation.id,
          recipientId: memberId,
          payload: {
            sessionId,
            status: ReservationStatus.CONFIRMADA,
          },
          dedupeKey: `class-reservation-confirmed:${reservation.id}`,
        },
      });

      return {
        id: reservation.id,
        sessionId: reservation.sessionId,
        className: session.classTemplate.name,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        status: ReservationStatus.CONFIRMADA,
        createdAt: reservation.createdAt,
      };
    });
  }

  async listMine(
    memberId: string,
    options: ClassReservationListOptions,
  ): Promise<ClassReservationSnapshot> {
    return this.prisma.$transaction(
      async (tx): Promise<ClassReservationSnapshot> => {
        const where: Prisma.ClassReservationWhereInput = {
          memberId,
          ...(options.status ? { status: options.status } : {}),
        };
        const [rows, total] = await Promise.all([
          tx.classReservation.findMany({
            where,
            orderBy: [{ session: { startsAt: 'desc' } }, { id: 'asc' }],
            skip: options.skip,
            take: options.take,
            select: {
              id: true,
              status: true,
              session: {
                select: {
                  startsAt: true,
                  endsAt: true,
                  classTemplate: { select: { name: true } },
                  trainer: {
                    select: {
                      profile: { select: { fullName: true } },
                    },
                  },
                  room: { select: { name: true } },
                },
              },
            },
          }),
          tx.classReservation.count({ where }),
        ]);

        const mapped: ListedClassReservation[] = rows.map((row) => ({
          id: row.id,
          className: row.session.classTemplate.name,
          trainerName:
            row.session.trainer.profile?.fullName ?? 'Entrenador no disponible',
          roomName: row.session.room.name,
          startsAt: row.session.startsAt,
          endsAt: row.session.endsAt,
          status: row.status,
        }));
        return { rows: mapped, total };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
