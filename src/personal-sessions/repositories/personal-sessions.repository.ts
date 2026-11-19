import { Injectable } from '@nestjs/common';
import { DomainError } from '@Common/errors';
import { serializable } from '@Common/repositories';
import { PrismaService } from '@Prisma/services';
import { formatGymDateTime } from '../../notifications/domain/gym-time.js';
import { NotificationService } from '../../notifications/services/notification.service.js';
import {
  PaymentStatus,
  PersonalSessionStatus,
  Prisma,
  SlotStatus,
  UserRole,
} from '@PrismaClient';
import type { NotificationModule } from '@PrismaClient';
import { eligibleMembership } from '../../memberships/repositories/eligible-membership.js';
import {
  SESSION_AMOUNT_USD,
  SESSION_CHARGE_CONCEPT,
  SESSION_CHARGE_VOID_REASON,
} from '../domain/session-rules.js';
import type {
  BookedSessionRecord,
  BookSlotInput,
  CancelledSessionRecord,
  CancelSessionInput,
  ListFreeSlotsInput,
  ListMineInput,
  LockedSession,
  LockedSlot,
  PersonalSessionPageRecord,
  PersonalSessionRecord,
  TrainerSlotOption,
} from './personal-sessions.repository.types.js';

const SLOT_UNAVAILABLE_MESSAGE = 'El horario no está disponible';
const MEMBERSHIP_MESSAGE = 'Tu membresía no está vigente';
const OVERLAP_MESSAGE = 'Ya tienes una sesión en ese horario';
const CANCELLABLE_MESSAGE = 'La sesión ya no puede cancelarse';
const SLOT_MISSING_MESSAGE = 'El horario ya no existe';
const MISSING_CHARGE_MESSAGE =
  'La sesión confirmada no tiene un cobro asociado.';

const sessionSelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  status: true,
  trainer: {
    select: { profile: { select: { fullName: true } }, email: true },
  },
} satisfies Prisma.PersonalSessionSelect;

const bookedSelect = {
  ...sessionSelect,
  payment: { select: { id: true, amountUsd: true, status: true } },
} satisfies Prisma.PersonalSessionSelect;

type SessionRow = Prisma.PersonalSessionGetPayload<{
  select: typeof sessionSelect;
}>;
type BookedRow = Prisma.PersonalSessionGetPayload<{
  select: typeof bookedSelect;
}>;

/** Único punto de H10/H11 que conoce Prisma. Toda escritura usa `serializable`. */
@Injectable()
export class PersonalSessionsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async findFreeSlots(input: ListFreeSlotsInput): Promise<TrainerSlotOption[]> {
    await this.assertTrainerExists(input.trainerId);
    return this.prisma.trainerSlot.findMany({
      where: {
        trainerId: input.trainerId,
        status: SlotStatus.LIBRE,
        startsAt: { gt: input.from, lte: input.until },
      },
      select: { id: true, startsAt: true, endsAt: true },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    });
  }

  async listMine(input: ListMineInput): Promise<PersonalSessionPageRecord> {
    const where: Prisma.PersonalSessionWhereInput = {
      memberId: input.memberId,
      ...(input.status ? { status: input.status } : {}),
    };
    return this.prisma.$transaction(async (tx) => {
      const [rows, total] = await Promise.all([
        tx.personalSession.findMany({
          where,
          select: sessionSelect,
          orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
          skip: input.skip,
          take: input.take,
        }),
        tx.personalSession.count({ where }),
      ]);
      return { items: rows.map((row) => this.toSessionRecord(row)), total };
    });
  }

  /** Reserva, sesión y cobro ocurren en una sola transacción serializable. */
  async book(input: BookSlotInput): Promise<BookedSessionRecord> {
    return serializable(this.prisma, async (tx) => {
      await this.lockUser(tx, input.memberId);
      const slot = await this.lockSlot(tx, input.slotId);

      this.assertBookableSlot(slot, input);
      await this.assertVigenteMembership(tx, input);
      await this.assertNoOverlap(tx, input.memberId, slot);
      await this.reserveSlot(tx, slot.id);

      const payment = await tx.payment.create({
        data: {
          memberId: input.memberId,
          concept: SESSION_CHARGE_CONCEPT,
          amountUsd: SESSION_AMOUNT_USD,
          status: PaymentStatus.PENDIENTE,
          dueDate: slot.startsAt,
        },
        select: { id: true, amountUsd: true, status: true },
      });

      const session = await tx.personalSession.create({
        data: {
          slotId: slot.id,
          trainerId: slot.trainerId,
          memberId: input.memberId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          status: PersonalSessionStatus.CONFIRMADA,
          paymentId: payment.id,
        },
        select: bookedSelect,
      });

      const when = formatGymDateTime(session.startsAt);
      const trainerName =
        session.trainer.profile?.fullName ?? session.trainer.email;
      await this.notificationService.send(
        {
          memberIds: [input.memberId],
          module: PERSONAL_SESSION_NOTIFICATION_MODULE,
          title: 'Sesión personal confirmada',
          message: `Tu sesión con ${trainerName} del ${when.date} a las ${when.time} fue confirmada.`,
          referenceId: session.id,
          dedupeKey: `PERS-CONF-${session.id}`,
        },
        tx,
      );

      return this.toBookedRecord({ ...session, payment });
    });
  }

  /** Cancela conservando el historial: nunca borra la fila de la sesión. */
  async cancel(input: CancelSessionInput): Promise<CancelledSessionRecord> {
    return serializable(this.prisma, async (tx) => {
      const session = await this.lockOwnedSession(tx, input);
      this.assertCancellable(session, input);

      await tx.personalSession.update({
        where: { id: session.id },
        data: {
          status: PersonalSessionStatus.CANCELADA,
          cancelledAt: input.now,
          cancelledById: input.memberId,
        },
      });

      const slotStatus = await this.releaseSlot(tx, session.slotId);
      const paymentStatus = await this.voidPendingCharge(tx, session, input);
      const when = formatGymDateTime(session.startsAt);
      await this.notificationService.send(
        {
          memberIds: [input.memberId],
          module: PERSONAL_SESSION_NOTIFICATION_MODULE,
          title: 'Sesión personal cancelada',
          message: `Tu sesión personal del ${when.date} a las ${when.time} fue cancelada.`,
          referenceId: session.id,
          dedupeKey: `PERS-CANCEL-${session.id}`,
        },
        tx,
      );

      return {
        id: session.id,
        status: PersonalSessionStatus.CANCELADA,
        cancelledAt: input.now,
        slotStatus,
        paymentStatus,
      };
    });
  }

  private async assertTrainerExists(trainerId: string): Promise<void> {
    const trainer = await this.prisma.user.findFirst({
      where: { id: trainerId, role: UserRole.ENTRENADOR, isActive: true },
      select: { id: true },
    });
    if (!trainer) {
      throw new DomainError('NOT_FOUND', 'Entrenador no encontrado.');
    }
  }

  private async lockUser(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
  }

  private async lockSlot(
    tx: Prisma.TransactionClient,
    slotId: string,
  ): Promise<LockedSlot> {
    const rows = await tx.$queryRaw<LockedSlot[]>`
      SELECT id::text AS id,
             trainer_id::text AS "trainerId",
             starts_at AS "startsAt",
             ends_at AS "endsAt",
             status
      FROM trainer_slots
      WHERE id = ${slotId}::uuid
      FOR UPDATE`;
    const slot = rows[0];
    if (!slot) {
      throw new DomainError('NOT_FOUND', 'Horario no encontrado.');
    }
    return slot;
  }

  private async lockOwnedSession(
    tx: Prisma.TransactionClient,
    input: CancelSessionInput,
  ): Promise<LockedSession> {
    const rows = await tx.$queryRaw<LockedSession[]>`
      SELECT id::text AS id,
             slot_id::text AS "slotId",
             starts_at AS "startsAt",
             status,
             payment_id::text AS "paymentId"
      FROM personal_sessions
      WHERE id = ${input.sessionId}::uuid
        AND member_id = ${input.memberId}::uuid
      FOR UPDATE`;
    const session = rows[0];
    if (!session) {
      throw new DomainError('NOT_FOUND', 'Sesión no encontrada.');
    }
    return session;
  }

  private assertBookableSlot(slot: LockedSlot, input: BookSlotInput): void {
    const startsAfterNow = slot.startsAt.getTime() > input.now.getTime();
    const insideWindow = slot.startsAt.getTime() <= input.windowEnd.getTime();
    if (slot.status !== SlotStatus.LIBRE || !startsAfterNow || !insideWindow) {
      throw new DomainError('CONFLICT', SLOT_UNAVAILABLE_MESSAGE);
    }
  }

  private async assertVigenteMembership(
    tx: Prisma.TransactionClient,
    input: BookSlotInput,
  ): Promise<void> {
    try {
      const membership = await eligibleMembership(
        tx,
        input.memberId,
        input.today,
      );
      await this.lockMembership(tx, membership.id);
    } catch (error) {
      if (error instanceof DomainError && error.kind === 'CONFLICT') {
        throw new DomainError('CONFLICT', MEMBERSHIP_MESSAGE);
      }
      throw error;
    }
  }

  private async lockMembership(
    tx: Prisma.TransactionClient,
    membershipId: string,
  ): Promise<void> {
    await tx.$queryRaw`SELECT id FROM memberships WHERE id = ${membershipId}::uuid FOR UPDATE`;
  }

  private async assertNoOverlap(
    tx: Prisma.TransactionClient,
    memberId: string,
    slot: LockedSlot,
  ): Promise<void> {
    const overlap = await tx.personalSession.findFirst({
      where: {
        memberId,
        status: PersonalSessionStatus.CONFIRMADA,
        startsAt: { lt: slot.endsAt },
        endsAt: { gt: slot.startsAt },
      },
      select: { id: true },
    });
    if (overlap) {
      throw new DomainError('CONFLICT', OVERLAP_MESSAGE);
    }
  }

  private async reserveSlot(
    tx: Prisma.TransactionClient,
    slotId: string,
  ): Promise<void> {
    const reserved = await tx.trainerSlot.updateMany({
      where: { id: slotId, status: SlotStatus.LIBRE },
      data: { status: SlotStatus.RESERVADO },
    });
    if (reserved.count !== 1) {
      throw new DomainError('CONFLICT', SLOT_UNAVAILABLE_MESSAGE);
    }
  }

  /** Libera el espacio sólo si sigue RESERVADO; nunca fuerza un estado ajeno. */
  private async releaseSlot(
    tx: Prisma.TransactionClient,
    slotId: string,
  ): Promise<SlotStatus> {
    const freed = await tx.trainerSlot.updateMany({
      where: { id: slotId, status: SlotStatus.RESERVADO },
      data: { status: SlotStatus.LIBRE },
    });
    if (freed.count === 1) {
      return SlotStatus.LIBRE;
    }

    const slot = await tx.trainerSlot.findUnique({
      where: { id: slotId },
      select: { status: true },
    });
    if (!slot) {
      throw new DomainError('NOT_FOUND', SLOT_MISSING_MESSAGE);
    }
    return slot.status;
  }

  private assertCancellable(
    session: LockedSession,
    input: CancelSessionInput,
  ): void {
    if (session.status !== PersonalSessionStatus.CONFIRMADA) {
      throw new DomainError('CONFLICT', CANCELLABLE_MESSAGE);
    }
    if (session.startsAt.getTime() < input.earliestStartsAt.getTime()) {
      throw new DomainError(
        'CONFLICT',
        'La sesión solo puede cancelarse hasta 12 horas antes',
      );
    }
  }

  private async voidPendingCharge(
    tx: Prisma.TransactionClient,
    session: LockedSession,
    input: CancelSessionInput,
  ): Promise<PaymentStatus | null> {
    if (!session.paymentId) {
      return null;
    }
    const payment = await tx.payment.findUnique({
      where: { id: session.paymentId },
      select: { status: true },
    });
    if (!payment || payment.status !== PaymentStatus.PENDIENTE) {
      return payment?.status ?? null;
    }

    await tx.payment.update({
      where: { id: session.paymentId },
      data: {
        status: PaymentStatus.ANULADO,
        voidedAt: input.now,
        voidReason: SESSION_CHARGE_VOID_REASON,
        voidedById: input.memberId,
      },
    });
    return PaymentStatus.ANULADO;
  }

  private toSessionRecord(row: SessionRow): PersonalSessionRecord {
    return {
      id: row.id,
      trainerName: row.trainer.profile?.fullName ?? row.trainer.email,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      status: row.status,
    };
  }

  private toBookedRecord(row: BookedRow): BookedSessionRecord {
    const payment = row.payment;
    if (!payment) {
      throw new DomainError('CONFLICT', MISSING_CHARGE_MESSAGE);
    }
    return {
      ...this.toSessionRecord(row),
      payment: {
        id: payment.id,
        amountUsd: Number(payment.amountUsd),
        status: payment.status,
      },
    };
  }
}

const PERSONAL_SESSION_NOTIFICATION_MODULE =
  'SESIONES_PERSONALES' as NotificationModule;
