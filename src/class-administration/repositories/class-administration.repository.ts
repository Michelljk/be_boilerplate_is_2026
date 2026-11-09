import { Injectable } from '@nestjs/common';
import {
  ClassStatus,
  Prisma,
  ReservationStatus,
  SessionStatus,
  UserRole,
} from '@PrismaClient';
import { PrismaService } from '@Prisma/services';
import { DomainError } from '@Common/errors';
import { serializable } from '@Common/repositories';
import { GymClock } from '@Common/time';
import type { ClassSession, ClassTemplate, Room } from '@PrismaClient';

export interface TemplateWriteData {
  name: string;
  trainerId: string;
  roomId: string;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  capacity: number;
}

export interface SessionWriteData {
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  roomId: string;
  trainerId: string;
}

export interface TrainerRecord {
  id: string;
  email: string;
  isActive: boolean;
  role: UserRole;
  name: string;
}

export type SessionWithDuration = ClassSession & {
  classTemplate: Pick<ClassTemplate, 'durationMinutes'>;
};

export interface CancellationResult {
  session: ClassSession;
  cancelledReservations: number;
}

export interface GenerationResult {
  created: ClassSession[];
}

function timeToMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean {
  return startA < endB && endA > startB;
}

function instantForLocalDate(date: string, time: string): Date {
  return new Date(`${date}T${time}:00-06:00`);
}

function endForLocalDate(
  date: string,
  startTime: string,
  durationMinutes: number,
): Date {
  const start = instantForLocalDate(date, startTime);
  return new Date(start.getTime() + durationMinutes * 60_000);
}

@Injectable()
export class ClassAdministrationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: GymClock,
  ) {}

  async createTemplate(data: TemplateWriteData): Promise<ClassTemplate> {
    return serializable(this.prisma, async (tx) => {
      await this.lockResourceRows(tx, data.trainerId, data.roomId);
      await this.assertTrainerAndRoom(
        tx,
        data.trainerId,
        data.roomId,
        data.capacity,
      );
      await this.assertTemplateConflict(tx, data, undefined);
      return tx.classTemplate.create({
        data: {
          ...data,
          status: ClassStatus.ACTIVA,
        },
      });
    });
  }

  async findTemplateById(id: string): Promise<ClassTemplate | null> {
    return this.prisma.classTemplate.findUnique({ where: { id } });
  }

  async updateTemplate(
    id: string,
    data: TemplateWriteData,
    now: Date,
  ): Promise<ClassTemplate> {
    return serializable(this.prisma, async (tx) => {
      await this.lockTemplate(tx, id);
      const current = await tx.classTemplate.findUnique({ where: { id } });
      if (!current)
        throw new DomainError('NOT_FOUND', 'La plantilla no existe.');

      await this.lockResourceRows(tx, data.trainerId, data.roomId);
      await this.assertTrainerAndRoom(
        tx,
        data.trainerId,
        data.roomId,
        data.capacity,
      );
      await this.assertTemplateConflict(tx, data, id);

      const updated = await tx.classTemplate.update({ where: { id }, data });
      const sessions = await tx.classSession.findMany({
        where: {
          classTemplateId: id,
          startsAt: { gt: now },
          status: SessionStatus.PROGRAMADA,
          reservations: { none: { status: ReservationStatus.CONFIRMADA } },
        },
      });

      for (const session of sessions) {
        const civilDate = this.clock.dateOf(session.startsAt);
        const startsAt = instantForLocalDate(civilDate, data.startTime);
        const endsAt = endForLocalDate(
          civilDate,
          data.startTime,
          data.durationMinutes,
        );
        await this.assertSessionConflict(
          tx,
          {
            startsAt,
            endsAt,
            roomId: data.roomId,
            trainerId: data.trainerId,
          },
          session.id,
        );
        await tx.classSession.update({
          where: { id: session.id },
          data: {
            startsAt,
            endsAt,
            capacity: data.capacity,
            roomId: data.roomId,
            trainerId: data.trainerId,
          },
        });
      }
      return updated;
    });
  }

  async generateSessions(
    templateId: string,
    candidates: ReadonlyArray<SessionWriteData>,
  ): Promise<GenerationResult> {
    return serializable(this.prisma, async (tx) => {
      await this.lockTemplate(tx, templateId);
      const template = await tx.classTemplate.findUnique({
        where: { id: templateId },
      });
      if (!template)
        throw new DomainError('NOT_FOUND', 'La plantilla no existe.');

      if (template.status !== ClassStatus.ACTIVA)
        throw new DomainError('CONFLICT', 'La plantilla está inactiva.');
      const created: ClassSession[] = [];
      for (const candidate of candidates) {
        const existing = await tx.classSession.findUnique({
          where: {
            classTemplateId_startsAt: {
              classTemplateId: templateId,
              startsAt: candidate.startsAt,
            },
          },
        });
        if (existing) continue;

        await this.assertSessionConflict(tx, candidate, undefined);
        try {
          const session = await tx.classSession.create({
            data: {
              classTemplateId: templateId,
              trainerId: template.trainerId,
              roomId: template.roomId,
              startsAt: candidate.startsAt,
              endsAt: candidate.endsAt,
              capacity: template.capacity,
              status: SessionStatus.PROGRAMADA,
            },
          });
          created.push(session);
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            continue;
          }
          throw error;
        }
      }
      return { created };
    });
  }

  async findSessionById(id: string): Promise<SessionWithDuration | null> {
    return this.prisma.classSession.findUnique({
      where: { id },
      include: { classTemplate: { select: { durationMinutes: true } } },
    });
  }

  async updateSession(
    id: string,
    data: SessionWriteData,
  ): Promise<SessionWithDuration> {
    return serializable(this.prisma, async (tx) => {
      await this.lockSession(tx, id);
      const current = await tx.classSession.findUnique({
        where: { id },
        include: { classTemplate: { select: { durationMinutes: true } } },
      });
      if (!current) throw new DomainError('NOT_FOUND', 'La sesión no existe.');
      if (
        current.status !== SessionStatus.PROGRAMADA ||
        current.startsAt <= this.clock.now()
      )
        throw new DomainError('CONFLICT', 'No se puede editar esta sesión.');
      if (data.startsAt <= this.clock.now())
        throw new DomainError(
          'INVALID',
          'El inicio de la sesión debe ser futuro.',
        );
      const reservations = await tx.classReservation.count({
        where: { sessionId: id, status: ReservationStatus.CONFIRMADA },
      });
      if (data.capacity < reservations)
        throw new DomainError(
          'CONFLICT',
          'El cupo no puede ser menor que las reservas confirmadas.',
        );
      await this.assertTrainerAndRoom(
        tx,
        data.trainerId,
        data.roomId,
        data.capacity,
      );
      await this.lockResourceRows(tx, data.trainerId, data.roomId);
      await this.assertSessionConflict(tx, data, id);
      await this.assertRoomCapacity(tx, data.roomId, data.capacity);
      return tx.classSession.update({
        where: { id },
        data: {
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          capacity: data.capacity,
          roomId: data.roomId,
          trainerId: data.trainerId,
        },
        include: { classTemplate: { select: { durationMinutes: true } } },
      });
    });
  }

  async countConfirmedReservations(sessionId: string): Promise<number> {
    return this.prisma.classReservation.count({
      where: { sessionId, status: ReservationStatus.CONFIRMADA },
    });
  }

  async findRoomById(id: string): Promise<Room | null> {
    return this.prisma.room.findUnique({ where: { id } });
  }

  async findTrainerById(id: string): Promise<TrainerRecord | null> {
    const trainer = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: { select: { fullName: true } } },
    });
    if (!trainer) return null;
    return {
      id: trainer.id,
      email: trainer.email,
      isActive: trainer.isActive,
      role: trainer.role,
      name: this.trainerName(trainer),
    };
  }

  async listRooms(): Promise<Room[]> {
    return this.prisma.room.findMany({ orderBy: { name: 'asc' } });
  }

  async listTrainers(): Promise<TrainerRecord[]> {
    const trainers = await this.prisma.user.findMany({
      where: { role: UserRole.ENTRENADOR, isActive: true },
      include: { profile: { select: { fullName: true } } },
      orderBy: { email: 'asc' },
    });
    return trainers.map((trainer) => ({
      id: trainer.id,
      email: trainer.email,
      isActive: trainer.isActive,
      role: trainer.role,
      name: this.trainerName(trainer),
    }));
  }

  async cancelSession(
    id: string,
    reason: string | null,
    cancelledById: string,
    cancelledAt: Date,
  ): Promise<CancellationResult> {
    return serializable(this.prisma, async (tx) => {
      await this.lockSession(tx, id);
      const session = await tx.classSession.findUnique({ where: { id } });
      if (!session) throw new DomainError('NOT_FOUND', 'La sesión no existe.');
      if (session.status !== SessionStatus.PROGRAMADA) {
        throw new DomainError('CONFLICT', 'No se puede cancelar esta sesión');
      }

      const confirmed = await tx.classReservation.findMany({
        where: { sessionId: id, status: ReservationStatus.CONFIRMADA },
        select: {
          id: true,
          memberId: true,
          membershipId: true,
          creditConsumed: true,
          creditRefunded: true,
        },
      });
      const updatedSession = await tx.classSession.update({
        where: { id },
        data: {
          status: SessionStatus.CANCELADA,
          cancelReason: reason,
          cancelledAt,
          cancelledById,
        },
      });

      for (const reservation of confirmed) {
        await tx.classReservation.update({
          where: { id: reservation.id },
          data: {
            status: ReservationStatus.CANCELADA_POR_GIMNASIO,
            cancelledAt,
            creditRefunded:
              reservation.creditConsumed && !reservation.creditRefunded
                ? true
                : undefined,
          },
        });
        if (
          reservation.creditConsumed &&
          !reservation.creditRefunded &&
          reservation.membershipId
        ) {
          const membership = await tx.membership.findUnique({
            where: { id: reservation.membershipId },
            select: { id: true, creditsRemaining: true },
          });
          if (membership && membership.creditsRemaining !== null) {
            await tx.membership.update({
              where: { id: membership.id },
              data: { creditsRemaining: { increment: 1 } },
            });
          }
        }
        await tx.domainEvent.create({
          data: {
            type: 'CLASS_SESSION_CANCELLED',
            aggregateId: id,
            recipientId: reservation.memberId,
            payload: { sessionId: id, reservationId: reservation.id },
            dedupeKey: `class-session-cancelled:${id}:${reservation.memberId}`,
          },
        });
      }
      return {
        session: updatedSession,
        cancelledReservations: confirmed.length,
      };
    });
  }

  private async assertTrainerAndRoom(
    tx: Prisma.TransactionClient,
    trainerId: string,
    roomId: string,
    capacity: number,
  ): Promise<void> {
    const trainer = await tx.user.findUnique({
      where: { id: trainerId },
      select: { role: true, isActive: true },
    });
    if (!trainer || trainer.role !== UserRole.ENTRENADOR || !trainer.isActive) {
      throw new DomainError('NOT_FOUND', 'El entrenador no existe.');
    }
    await this.assertRoomCapacity(tx, roomId, capacity);
  }

  private async assertRoomCapacity(
    tx: Prisma.TransactionClient,
    roomId: string,
    capacity: number,
  ): Promise<void> {
    const room = await tx.room.findUnique({
      where: { id: roomId },
      select: { capacity: true },
    });
    if (!room) throw new DomainError('NOT_FOUND', 'La sala no existe.');
    if (capacity > room.capacity) {
      throw new DomainError(
        'CONFLICT',
        'El cupo supera la capacidad de la sala.',
      );
    }
  }

  private async assertTemplateConflict(
    tx: Prisma.TransactionClient,
    data: TemplateWriteData,
    excludedId: string | undefined,
  ): Promise<void> {
    const templates = await tx.classTemplate.findMany({
      where: {
        status: ClassStatus.ACTIVA,
        weekday: data.weekday,
        ...(excludedId ? { id: { not: excludedId } } : {}),
        OR: [{ roomId: data.roomId }, { trainerId: data.trainerId }],
      },
      select: { id: true, startTime: true, durationMinutes: true },
    });
    const start = timeToMinutes(data.startTime);
    const end = start + data.durationMinutes;
    if (
      templates.some((item) =>
        intervalsOverlap(
          start,
          end,
          timeToMinutes(item.startTime),
          timeToMinutes(item.startTime) + item.durationMinutes,
        ),
      )
    ) {
      throw new DomainError('CONFLICT', 'Existe un conflicto de horario');
    }
  }

  private async assertSessionConflict(
    tx: Prisma.TransactionClient,
    data: Pick<
      SessionWriteData,
      'startsAt' | 'endsAt' | 'roomId' | 'trainerId'
    >,
    excludedId: string | undefined,
  ): Promise<void> {
    const sessions = await tx.classSession.findMany({
      where: {
        status: { not: SessionStatus.CANCELADA },
        startsAt: { lt: data.endsAt },
        endsAt: { gt: data.startsAt },
        ...(excludedId ? { id: { not: excludedId } } : {}),
        OR: [{ roomId: data.roomId }, { trainerId: data.trainerId }],
      },
      select: { id: true },
    });
    if (sessions.length > 0)
      throw new DomainError('CONFLICT', 'Existe un conflicto de horario');
  }

  private trainerName(trainer: {
    profile: { fullName: string } | null;
  }): string {
    if (!trainer.profile)
      throw new DomainError(
        'CONFLICT',
        'El entrenador no tiene un perfil completo.',
      );
    return trainer.profile.fullName;
  }

  private async lockTemplate(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<void> {
    await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM class_templates WHERE id = ${id}::uuid FOR UPDATE`;
  }

  private async lockSession(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<void> {
    await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM class_sessions WHERE id = ${id}::uuid FOR UPDATE`;
  }

  private async lockResourceRows(
    tx: Prisma.TransactionClient,
    trainerId: string,
    roomId: string,
  ): Promise<void> {
    await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM users WHERE id = ${trainerId}::uuid FOR UPDATE`;
    await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM rooms WHERE id = ${roomId}::uuid FOR UPDATE`;
  }
}
