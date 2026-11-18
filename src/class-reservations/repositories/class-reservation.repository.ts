import { Injectable } from '@nestjs/common';
import {
  Prisma,
  AttendanceStatus,
  PlanType,
  ReservationStatus,
  SessionStatus,
} from '@PrismaClient';
import { DomainError } from '@Common/errors';
import { serializable } from '@Common/repositories';
import { isCalendarDate } from '@Common/time';
import { PrismaService } from '@Prisma/services';
import { eligibleMembership } from '../../memberships/repositories/eligible-membership.js';
import {
  RESERVATION_NOT_FOUND_MESSAGE,
  SESSION_NOT_FOUND_MESSAGE,
  assertCancelWindowOpen,
  assertCancellableByMember,
  assertReservationSlotAvailable,
  assertSeatsAvailable,
  assertSessionBookable,
  computeFreeSpots,
  shouldRestoreCredit,
} from '../domain/reservation-rules.js';
import type { TransactionClient } from '../domain/reservation-rules.js';
import type {
  CancelledClassReservation,
  ClassReservationListOptions,
  ClassReservationSnapshot,
  CreatedClassReservation,
} from './class-reservation.repository.types.js';
import { ClassReservationReader } from './class-reservation.reader.js';

/** Sesión congelada que H5 valida antes de aceptar una reserva. */
interface BookableSession {
  id: string;
  status: SessionStatus;
  capacity: number;
  startsAt: Date;
  endsAt: Date;
  className: string;
}

/** Reserva con lo necesario para aplicar las reglas de H6. */
interface CancellableReservation {
  id: string;
  sessionId: string;
  status: ReservationStatus;
  creditConsumed: boolean;
  creditRefunded: boolean;
  membershipId: string | null;
  startsAt: Date;
  capacity: number;
  className: string;
}

/** Único punto de H5/H6 que conoce Prisma: todo el SQL vive aquí. */
@Injectable()
export class ClassReservationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reader: ClassReservationReader,
  ) {}

  async create(
    memberId: string,
    sessionId: string,
    now: Date,
    today: string,
  ): Promise<CreatedClassReservation> {
    return serializable(this.prisma, async (tx) =>
      this.reserve(tx, memberId, sessionId, now, today),
    );
  }

  async cancelOwn(
    id: string,
    memberId: string,
    now: Date,
  ): Promise<CancelledClassReservation> {
    return serializable(this.prisma, async (tx) =>
      this.cancelOwned(tx, id, memberId, now),
    );
  }

  listMine(
    memberId: string,
    options: ClassReservationListOptions,
  ): Promise<ClassReservationSnapshot> {
    return this.reader.listMine(memberId, options);
  }

  private async reserve(
    tx: TransactionClient,
    memberId: string,
    sessionId: string,
    now: Date,
    today: string,
  ): Promise<CreatedClassReservation> {
    this.assertCivilDate(today);
    await this.lockRow(tx, 'users', memberId);
    await this.lockRow(tx, 'class_sessions', sessionId);

    const session = await this.findBookableSession(tx, sessionId);
    assertSessionBookable(session, now);

    const membership = await this.lockedEligibleMembership(tx, memberId, today);
    await this.assertReservationSlotAvailable(tx, sessionId, memberId);
    await this.assertNoOverlap(tx, memberId, session);
    const confirmedCount = await tx.classReservation.count({
      where: { sessionId, status: ReservationStatus.CONFIRMADA },
    });
    assertSeatsAvailable(session.capacity, confirmedCount);
    const creditConsumed = await this.consumeCredit(tx, membership);

    const created = await tx.classReservation.create({
      data: {
        sessionId,
        memberId,
        membershipId: creditConsumed ? membership.id : null,
        creditConsumed,
        creditRefunded: false,
        status: ReservationStatus.CONFIRMADA,
        attendance: AttendanceStatus.PENDIENTE,
      },
      select: { id: true, createdAt: true },
    });

    await this.emitConfirmed(tx, created.id, session, memberId);
    return this.toCreatedReservation(created.id, session);
  }

  private assertCivilDate(today: string): void {
    if (!isCalendarDate(today)) {
      throw new DomainError(
        'INVALID',
        'La fecha civil del gimnasio no es válida.',
      );
    }
  }

  private async findBookableSession(
    tx: TransactionClient,
    sessionId: string,
  ): Promise<BookableSession> {
    const session = await tx.classSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        capacity: true,
        startsAt: true,
        endsAt: true,
        classTemplate: { select: { name: true } },
      },
    });
    if (!session) {
      throw new DomainError('NOT_FOUND', SESSION_NOT_FOUND_MESSAGE);
    }
    return { ...session, className: session.classTemplate.name };
  }

  private async lockedEligibleMembership(
    tx: TransactionClient,
    memberId: string,
    today: string,
  ) {
    const membership = await eligibleMembership(tx, memberId, today);
    await this.lockRow(tx, 'memberships', membership.id);
    return membership;
  }

  private async assertReservationSlotAvailable(
    tx: TransactionClient,
    sessionId: string,
    memberId: string,
  ): Promise<void> {
    const existing = await tx.classReservation.findUnique({
      where: { sessionId_memberId: { sessionId, memberId } },
      select: { status: true },
    });
    assertReservationSlotAvailable(existing);
  }

  private async assertNoOverlap(
    tx: TransactionClient,
    memberId: string,
    session: BookableSession,
  ): Promise<void> {
    const overlapping = await tx.classReservation.findFirst({
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
    if (overlapping) {
      throw new DomainError('CONFLICT', OVERLAP_MESSAGE);
    }
  }

  /** Descuenta el crédito sólo si el plan es por clases y queda saldo. */
  private async consumeCredit(
    tx: TransactionClient,
    membership: { id: string; plan: { type: PlanType } },
  ): Promise<boolean> {
    if (membership.plan.type !== PlanType.BY_CLASSES) {
      return false;
    }
    const updated = await tx.membership.updateMany({
      where: { id: membership.id, creditsRemaining: { gt: 0 } },
      data: { creditsRemaining: { decrement: 1 } },
    });
    if (updated.count !== 1) {
      throw new DomainError('CONFLICT', NO_CREDITS_MESSAGE);
    }
    return true;
  }

  private async emitConfirmed(
    tx: TransactionClient,
    reservationId: string,
    session: BookableSession,
    memberId: string,
  ): Promise<void> {
    await tx.domainEvent.create({
      data: {
        type: 'CLASS_RESERVATION_CONFIRMED',
        aggregateId: reservationId,
        recipientId: memberId,
        payload: {
          reservationId,
          sessionId: session.id,
          className: session.className,
          startsAt: session.startsAt.toISOString(),
          status: ReservationStatus.CONFIRMADA,
        },
        dedupeKey: `class-reservation-confirmed:${reservationId}`,
      },
    });
  }

  private toCreatedReservation(
    id: string,
    session: BookableSession,
  ): CreatedClassReservation {
    return {
      id,
      sessionId: session.id,
      className: session.className,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      status: ReservationStatus.CONFIRMADA,
      createdAt: new Date(),
    };
  }

  private async cancelOwned(
    tx: TransactionClient,
    id: string,
    memberId: string,
    now: Date,
  ): Promise<CancelledClassReservation> {
    const located = await this.findReservationSession(tx, id);
    await this.lockRow(tx, 'class_sessions', located);
    await this.lockRow(tx, 'class_reservations', id);

    const reservation = await this.findCancellableReservation(tx, id);
    if (!reservation || reservation.memberId !== memberId) {
      throw new DomainError('NOT_FOUND', RESERVATION_NOT_FOUND_MESSAGE);
    }

    assertCancellableByMember(reservation.status);
    assertCancelWindowOpen(reservation.startsAt, now);

    const restoresCredit = shouldRestoreCredit(reservation);
    await this.writeCancellation(tx, id, memberId, now, restoresCredit);
    if (restoresCredit && reservation.membershipId) {
      await this.refundCredit(tx, reservation.membershipId);
    }
    await this.emitCancelled(tx, reservation, memberId, now);

    const confirmedCount = await this.countConfirmed(tx, reservation.sessionId);
    return {
      id,
      status: ReservationStatus.CANCELADA,
      cancelledAt: now,
      freeSpots: computeFreeSpots(reservation.capacity, confirmedCount),
    };
  }

  /** Lee el padre antes de bloquear para fijar un orden de candados. */
  private async findReservationSession(
    tx: TransactionClient,
    id: string,
  ): Promise<string> {
    const row = await tx.classReservation.findUnique({
      where: { id },
      select: { sessionId: true },
    });
    if (!row) {
      throw new DomainError('NOT_FOUND', RESERVATION_NOT_FOUND_MESSAGE);
    }
    return row.sessionId;
  }

  private async findCancellableReservation(tx: TransactionClient, id: string) {
    const reservation = await tx.classReservation.findUnique({
      where: { id },
      select: {
        id: true,
        memberId: true,
        sessionId: true,
        status: true,
        creditConsumed: true,
        creditRefunded: true,
        membershipId: true,
        session: {
          select: {
            startsAt: true,
            capacity: true,
            classTemplate: { select: { name: true } },
          },
        },
      },
    });
    if (!reservation) {
      return null;
    }
    const shaped: CancellableReservation & { memberId: string } = {
      ...reservation,
      startsAt: reservation.session.startsAt,
      capacity: reservation.session.capacity,
      className: reservation.session.classTemplate.name,
    };
    return shaped;
  }

  /** Estado, autor y marca de crédito quedan en una sola escritura tipada. */
  private async writeCancellation(
    tx: TransactionClient,
    id: string,
    memberId: string,
    now: Date,
    restoresCredit: boolean,
  ): Promise<void> {
    await tx.classReservation.update({
      where: { id },
      data: {
        status: ReservationStatus.CANCELADA,
        cancelledAt: now,
        cancelledById: memberId,
        creditRefunded: restoresCredit ? true : undefined,
      },
    });
  }

  private async refundCredit(
    tx: TransactionClient,
    membershipId: string,
  ): Promise<void> {
    await tx.membership.update({
      where: { id: membershipId },
      data: { creditsRemaining: { increment: 1 } },
    });
  }

  private async emitCancelled(
    tx: TransactionClient,
    reservation: CancellableReservation & { memberId: string },
    memberId: string,
    _now: Date,
  ): Promise<void> {
    await tx.domainEvent.create({
      data: {
        type: 'CLASS_RESERVATION_CANCELLED',
        aggregateId: reservation.id,
        recipientId: memberId,
        payload: {
          reservationId: reservation.id,
          sessionId: reservation.sessionId,
          className: reservation.className,
          startsAt: reservation.startsAt.toISOString(),
          status: ReservationStatus.CANCELADA,
          message: 'El cupo fue liberado.',
        },
        dedupeKey: `class-reservation-cancelled:${reservation.id}`,
      },
    });
  }

  private async countConfirmed(
    tx: TransactionClient,
    sessionId: string,
  ): Promise<number> {
    return tx.classReservation.count({
      where: { sessionId, status: ReservationStatus.CONFIRMADA },
    });
  }

  /** Candado de fila con SQL parametrizado; nunca se concatena entrada. */
  private async lockRow(
    tx: TransactionClient,
    table: LockedTable,
    id: string,
  ): Promise<void> {
    const statement = LOCK_STATEMENTS[table];
    await tx.$queryRaw`SELECT id FROM ${statement} WHERE id = ${id}::uuid FOR UPDATE`;
  }
}

const OVERLAP_MESSAGE = 'La sesión se solapa con otra reserva confirmada.';
const NO_CREDITS_MESSAGE = 'No tienes clases restantes para reservar.';
type LockedTable =
  'users' | 'class_sessions' | 'class_reservations' | 'memberships';
const LOCK_STATEMENTS = {
  users: Prisma.sql`"users"`,
  class_sessions: Prisma.sql`"class_sessions"`,
  class_reservations: Prisma.sql`"class_reservations"`,
  memberships: Prisma.sql`"memberships"`,
} as const;
