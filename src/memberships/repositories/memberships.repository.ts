import { Injectable } from '@nestjs/common';
import { serializable } from '@Common/repositories';
import { PrismaService } from '@Prisma/services';
import {
  MembershipStatus,
  PaymentConcept,
  PaymentStatus,
  PlanStatus,
  PlanType,
  Prisma,
  UserRole,
} from '@PrismaClient';
import type {
  MembershipOperation,
  MembershipRequestStatus,
} from '../domain/membership-request.js';

/** Proyección que consume la regla canónica: membresa + plan + cobro. */
const cardInclude = {
  plan: { select: { id: true, name: true, type: true, benefits: true } },
  payment: { select: { status: true, memberId: true, concept: true } },
} satisfies Prisma.MembershipInclude;

export type MembershipCardRow = Prisma.MembershipGetPayload<{
  include: typeof cardInclude;
}>;

const planSelect = {
  id: true,
  name: true,
  type: true,
  priceUsd: true,
  durationMonths: true,
  durationDays: true,
  credits: true,
  benefits: true,
  status: true,
} satisfies Prisma.MembershipPlanSelect;

export type MembershipPlanRow = Prisma.MembershipPlanGetPayload<{
  select: typeof planSelect;
}>;

/** Solicitud con el plan y el cobro necesarios para aplicar la vigencia. */
const requestInclude = {
  plan: { select: planSelect },
  payment: { select: { status: true, memberId: true, concept: true } },
} satisfies Prisma.MembershipRequestInclude;

export type MembershipRequestRow = Prisma.MembershipRequestGetPayload<{
  include: typeof requestInclude;
}>;

export type PlanWriteValues = {
  name: string;
  type: PlanType;
  priceUsd: Prisma.Decimal;
  durationMonths: number | null;
  durationDays: number | null;
  credits: number | null;
  benefits: string[];
  status: PlanStatus;
};

export interface MembershipWriteData {
  memberId: string;
  planId: string;
  paymentId: string;
  startsOn: Date;
  endsOn: Date;
  creditsRemaining: number | null;
  status: MembershipStatus;
}

export interface RenewalWriteData extends MembershipWriteData {
  membershipId: string;
}

export interface RequestWriteData {
  memberId: string;
  membershipId: string | null;
  planId: string;
  paymentId: string;
  operation: MembershipOperation;
  expectedStartsOn: Date | null;
  expectedEndsOn: Date | null;
  createdById: string;
}

export type WriteClient = Prisma.TransactionClient;

/** Acceso a datos de membresas, planes y solicitudes con el cliente tipado. */
@Injectable()
export class MembershipsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Toda escritura multi-tabla del dominio corre dentro de esta transacción. */
  transaction<T>(work: (tx: WriteClient) => Promise<T>): Promise<T> {
    return serializable(this.prisma, work);
  }

  /** Membresas del miembro, de la más reciente a la más antigua. */
  findCards(memberId: string): Promise<MembershipCardRow[]> {
    return this.findCardsTx(this.prisma, memberId);
  }

  /** Misma proyección, pero dentro de la transacción que la solicita (H2). */
  findCardsTx(tx: WriteClient, memberId: string): Promise<MembershipCardRow[]> {
    return tx.membership.findMany({
      where: { memberId },
      include: cardInclude,
      orderBy: [
        { endsOn: 'desc' },
        { startsOn: 'desc' },
        { createdAt: 'desc' },
        { id: 'asc' },
      ],
    });
  }

  findCard(membershipId: string): Promise<MembershipCardRow | null> {
    return this.findCardTx(this.prisma, membershipId);
  }

  /** Lectura de una membresa con el cliente de la transacción activa. */
  findCardTx(
    tx: WriteClient,
    membershipId: string,
  ): Promise<MembershipCardRow | null> {
    return tx.membership.findUnique({
      where: { id: membershipId },
      include: cardInclude,
    });
  }

  /** Número de miembro de una membresa: lo exige el body de H2 (COMPRA/RENOVACIÓN). */
  findMemberNumberByMembership(membershipId: string): Promise<string | null> {
    return this.prisma.membership
      .findUnique({
        where: { id: membershipId },
        select: {
          member: {
            select: { memberProfile: { select: { memberNumber: true } } },
          },
        },
      })
      .then((row) => row?.member.memberProfile?.memberNumber ?? null);
  }

  /** Candidatas del job diario: sólo las persistidas como VIGENTE. */
  findVigenteCards(): Promise<MembershipCardRow[]> {
    return this.prisma.membership.findMany({
      where: { status: MembershipStatus.VIGENTE },
      include: cardInclude,
      orderBy: { endsOn: 'asc' },
    });
  }

  /** Pasa a VENCIDA el subconjunto indicado; es idempotente por el filtro. */
  async markVencidas(
    tx: WriteClient,
    membershipIds: string[],
  ): Promise<number> {
    if (membershipIds.length === 0) {
      return 0;
    }
    const updated = await tx.membership.updateMany({
      where: { id: { in: membershipIds }, status: MembershipStatus.VIGENTE },
      data: { status: MembershipStatus.VENCIDA },
    });
    return updated.count;
  }

  findMemberIdByNumber(
    tx: WriteClient,
    memberNumber: string,
  ): Promise<string | null> {
    return tx.user
      .findFirst({
        where: {
          role: UserRole.MIEMBRO,
          isActive: true,
          memberProfile: { memberNumber },
        },
        select: { id: true },
      })
      .then((row) => row?.id ?? null);
  }

  findPlanById(
    tx: WriteClient,
    planId: string,
  ): Promise<MembershipPlanRow | null> {
    return tx.membershipPlan.findUnique({
      where: { id: planId },
      select: planSelect,
    });
  }

  findPlanIdByName(tx: WriteClient, name: string): Promise<string | null> {
    return tx.membershipPlan
      .findUnique({ where: { name }, select: { id: true } })
      .then((row) => row?.id ?? null);
  }

  listPlans(status?: PlanStatus): Promise<MembershipPlanRow[]> {
    return this.prisma.membershipPlan.findMany({
      where: status ? { status } : {},
      select: planSelect,
      orderBy: { name: 'asc' },
    });
  }

  createPlan(
    tx: WriteClient,
    data: PlanWriteValues,
  ): Promise<MembershipPlanRow> {
    return tx.membershipPlan.create({ data, select: planSelect });
  }

  updatePlan(
    tx: WriteClient,
    planId: string,
    data: PlanWriteValues,
  ): Promise<MembershipPlanRow> {
    return tx.membershipPlan.update({
      where: { id: planId },
      data,
      select: planSelect,
    });
  }

  findPendingRequestId(
    tx: WriteClient,
    memberId: string,
  ): Promise<string | null> {
    return tx.membershipRequest
      .findFirst({
        where: { memberId, status: 'PENDIENTE_PAGO' },
        select: { id: true },
      })
      .then((row) => row?.id ?? null);
  }

  findRequestByPayment(
    tx: WriteClient,
    paymentId: string,
  ): Promise<MembershipRequestRow | null> {
    return tx.membershipRequest.findUnique({
      where: { paymentId },
      include: requestInclude,
    });
  }

  /** Precio vigente del plan que originó un pago de membresía. */
  async findReplacementAmountTx(
    tx: WriteClient,
    paymentId: string,
  ): Promise<string | null> {
    const request = await tx.membershipRequest.findUnique({
      where: { paymentId },
      select: { plan: { select: { priceUsd: true } } },
    });
    if (request) {
      return request.plan.priceUsd.toFixed(2);
    }
    const membership = await tx.membership.findUnique({
      where: { paymentId },
      select: { plan: { select: { priceUsd: true } } },
    });
    return membership?.plan.priceUsd.toFixed(2) ?? null;
  }

  /** Guarda el estado previo antes de tocar la vigencia agregada. */
  async savePreviousState(
    tx: WriteClient,
    requestId: string,
    state: MembershipPreviousState,
  ): Promise<void> {
    await tx.$executeRaw(
      Prisma.sql`
        UPDATE membership_requests
        SET previous_state = ${JSON.stringify(state)}::jsonb
        WHERE id = ${requestId}::uuid
      `,
    );
  }

  async findPreviousState(
    tx: WriteClient,
    paymentId: string,
  ): Promise<MembershipPreviousState | null> {
    const rows = await tx.$queryRaw<Array<{ previous_state: unknown }>>(
      Prisma.sql`
        SELECT previous_state
        FROM membership_requests
        WHERE payment_id = ${paymentId}::uuid
        LIMIT 1
      `,
    );
    const value = rows[0]?.previous_state;
    return isPreviousState(value) ? value : null;
  }

  async cancelRequest(tx: WriteClient, requestId: string): Promise<void> {
    await tx.membershipRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELADA' },
      select: { id: true },
    });
  }

  /** Solicitudes pendientes cuyo cobro ya está pagado: cola del reconciliador. */
  findPendingRequests(
    tx: WriteClient,
    limit: number,
  ): Promise<MembershipRequestRow[]> {
    const statuses: MembershipRequestStatus[] = ['PENDIENTE_PAGO'];
    return tx.membershipRequest.findMany({
      where: {
        status: { in: statuses },
        payment: { status: PaymentStatus.PAGADO },
      },
      include: requestInclude,
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  createCharge(tx: WriteClient, data: NewCharge): Promise<string> {
    return tx.payment
      .create({
        data: {
          memberId: data.memberId,
          concept: PaymentConcept.MEMBRESIA,
          amountUsd: new Prisma.Decimal(data.amountUsd),
          status: PaymentStatus.PENDIENTE,
          dueDate: data.dueDate,
        },
        select: { id: true },
      })
      .then((row) => row.id);
  }

  createRequest(tx: WriteClient, data: RequestWriteData): Promise<string> {
    return tx.membershipRequest
      .create({
        data: {
          memberId: data.memberId,
          membershipId: data.membershipId,
          planId: data.planId,
          paymentId: data.paymentId,
          operation: data.operation,
          status: 'PENDIENTE_PAGO',
          expectedStartsOn: data.expectedStartsOn,
          expectedEndsOn: data.expectedEndsOn,
          createdById: data.createdById,
        },
        select: { id: true },
      })
      .then((row) => row.id);
  }

  markRequestApplied(
    tx: WriteClient,
    requestId: string,
    membershipId: string,
    appliedAt: Date,
  ): Promise<void> {
    return tx.membershipRequest
      .update({
        where: { id: requestId },
        data: { status: 'APLICADA', membershipId, appliedAt },
        select: { id: true },
      })
      .then(() => undefined);
  }

  createMembership(
    tx: WriteClient,
    data: MembershipWriteData,
  ): Promise<string> {
    return tx.membership
      .create({
        data: {
          memberId: data.memberId,
          planId: data.planId,
          paymentId: data.paymentId,
          startsOn: data.startsOn,
          endsOn: data.endsOn,
          creditsRemaining: data.creditsRemaining,
          status: data.status,
        },
        select: { id: true },
      })
      .then((row) => row.id);
  }

  /** Renueva prolongando el mismo registro: conserva el historial del miembro. */
  renewMembership(tx: WriteClient, data: RenewalWriteData): Promise<string> {
    return tx.membership
      .update({
        where: { id: data.membershipId },
        data: {
          planId: data.planId,
          paymentId: data.paymentId,
          startsOn: data.startsOn,
          endsOn: data.endsOn,
          creditsRemaining: data.creditsRemaining,
          status: data.status,
        },
        select: { id: true },
      })
      .then((row) => row.id);
  }

  async restoreMembership(
    tx: WriteClient,
    state: MembershipPreviousState,
  ): Promise<void> {
    await tx.membership.update({
      where: { id: state.membershipId },
      data: {
        memberId: state.memberId,
        planId: state.planId,
        paymentId: state.paymentId,
        startsOn: dayValue(state.startsOn),
        endsOn: dayValue(state.endsOn),
        creditsRemaining: state.creditsRemaining,
        status: state.status as MembershipStatus,
      },
      select: { id: true },
    });
  }

  async setMembershipStatus(
    tx: WriteClient,
    membershipId: string,
    status: MembershipStatus,
  ): Promise<void> {
    await tx.membership.update({
      where: { id: membershipId },
      data: { status },
      select: { id: true },
    });
  }

  /** Crea una fila inmutable por cada pago aplicado; no duplica por pago. */
  async createMembershipPeriod(
    tx: WriteClient,
    data: MembershipPeriodWriteData,
  ): Promise<void> {
    await tx.$executeRaw(
      Prisma.sql`
        INSERT INTO membership_periods
          (membership_id, member_id, plan_id, payment_id, starts_on, ends_on, credits_granted)
        VALUES
          (${data.membershipId}::uuid, ${data.memberId}::uuid, ${data.planId}::uuid,
           ${data.paymentId}::uuid, ${data.startsOn}::date, ${data.endsOn}::date,
           ${data.creditsGranted})
        ON CONFLICT (payment_id) DO NOTHING
      `,
    );
  }

  /** Backfill perezoso para una membresía legacy sin período histórico. */
  async ensureMembershipPeriodSnapshot(
    tx: WriteClient,
    data: MembershipPeriodWriteData,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT id
        FROM membership_periods
        WHERE payment_id = ${data.paymentId}::uuid
        LIMIT 1
      `,
    );
    if (rows.length === 0) {
      await this.createMembershipPeriod(tx, data);
    }
  }

  findPaymentStatus(
    tx: WriteClient,
    paymentId: string,
  ): Promise<PaymentStatus | null> {
    return tx.payment
      .findUnique({ where: { id: paymentId }, select: { status: true } })
      .then((row) => row?.status ?? null);
  }
}

export interface NewCharge {
  memberId: string;
  amountUsd: string;
  dueDate: Date;
}

export interface MembershipPeriodWriteData {
  membershipId: string;
  memberId: string;
  planId: string;
  paymentId: string;
  startsOn: Date;
  endsOn: Date;
  creditsGranted: number | null;
}

export interface MembershipPreviousState {
  membershipId: string;
  memberId: string;
  planId: string;
  paymentId: string;
  startsOn: string;
  endsOn: string;
  creditsRemaining: number | null;
  status: string;
}

function dayValue(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

function isPreviousState(value: unknown): value is MembershipPreviousState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.membershipId === 'string' &&
    typeof candidate.memberId === 'string' &&
    typeof candidate.planId === 'string' &&
    typeof candidate.paymentId === 'string' &&
    typeof candidate.startsOn === 'string' &&
    typeof candidate.endsOn === 'string' &&
    (candidate.creditsRemaining === null ||
      typeof candidate.creditsRemaining === 'number') &&
    typeof candidate.status === 'string'
  );
}
