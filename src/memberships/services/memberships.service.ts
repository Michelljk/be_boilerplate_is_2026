import { Injectable } from '@nestjs/common';
import { DomainError } from '@Common/errors';
import { GymClock } from '@Common/time';
import {
  Prisma,
  MembershipStatus,
  PaymentStatus,
  PlanStatus,
} from '@PrismaClient';
import {
  MembershipsRepository,
  type MembershipPlanRow,
  type PlanWriteValues,
  type MembershipPreviousState,
  type WriteClient,
} from '../repositories/memberships.repository.js';
import {
  civilDay,
  isMembershipEligible,
  isPaidMembershipCharge,
  membershipStatusLabel,
  selectCurrentMembership,
} from '../domain/eligibility.js';
import {
  newPeriod,
  periodStatus,
  renewalPeriod,
  type PlanDuration,
} from '../domain/membership-period.js';
import {
  MEMBERSHIP_OPERATIONS,
  PENDING_PAYMENT,
  type MembershipOperation,
} from '../domain/membership-request.js';
import { assertPlanStatus, assertValidPlan } from '../domain/plan-rules.js';
import type { PlanDraft } from '../domain/plan-rules.js';
import {
  MyMembershipResponseDto,
  MembershipCardResponseDto,
  PlanListResponseDto,
  PlanResponseDto,
  PurchaseResponseDto,
  RenewalResponseDto,
  type PlanWriteDto,
  type UpdatePlanDto,
} from '../dto/membership.dto.js';

/** Duración del plan en la forma que entiende el dominio de períodos. */
function planDuration(row: MembershipPlanRow): PlanDuration {
  return {
    type: row.type,
    durationMonths: row.durationMonths,
    durationDays: row.durationDays,
    classCredits: row.credits,
  };
}

/** Convierte una fecha civil `YYYY-MM-DD` en el `Date` UTC que guarda `@db.Date`. */
function dayValue(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/**
 * Altas, renovaciones, catálogo de planes y consulta del estado de membresa.
 *
 * Regla canónica (H1/H14): la única fuente de la verdad es
 * `src/memberships/domain/eligibility.ts`; este servicio no reimplementa el
 * cálculo, lo compone.
 */
@Injectable()
export class MembershipsService {
  constructor(
    private readonly repo: MembershipsRepository,
    private readonly clock: GymClock,
  ) {}

  /** H1: siempre el miembro autenticado; sin filas, `membership` es null. */
  async mine(memberId: string): Promise<MyMembershipResponseDto> {
    const today = this.clock.today();
    const rows = await this.repo.findCards(memberId);
    const charged = rows.filter((row) => isPaidMembershipCharge(row));
    const current = selectCurrentMembership(charged, today);
    const dto = new MyMembershipResponseDto();
    dto.membership = current
      ? MembershipCardResponseDto.fromRow(current, today)
      : null;
    return dto;
  }

  /** Catálogo para el formulario de compra (H2) y el de planes (H3). */
  async listPlans(status?: string): Promise<PlanListResponseDto> {
    if (status !== undefined) {
      assertPlanStatus(status);
    }
    const rows = await this.repo.listPlans(status as PlanStatus | undefined);
    const dto = new PlanListResponseDto();
    dto.data = rows.map((row) => PlanResponseDto.fromRow(row));
    return dto;
  }

  /** H3: alta de plan con las reglas de duración del PDF. */
  async createPlan(input: PlanWriteDto): Promise<PlanResponseDto> {
    // Se copian los campos uno a uno: expandir la instancia del DTO perdería su
    // prototipo y arrastraría metadatos de validación que no son datos.
    const draft = assertValidPlan({
      name: input.name,
      type: input.type,
      priceUsd: input.priceUsd,
      durationMonths: input.durationMonths ?? null,
      durationDays: input.durationDays ?? null,
      classCredits: input.classCredits ?? null,
      benefits: input.benefits,
      status: input.status,
    });
    return this.repo.transaction(async (tx) => {
      const duplicated = await this.repo.findPlanIdByName(tx, draft.name);
      if (duplicated) {
        throw new DomainError('CONFLICT', 'Ya existe un plan con ese nombre.');
      }
      const row = await this.repo.createPlan(tx, toWriteValues(draft));
      return PlanResponseDto.fromRow(row);
    });
  }

  /** H3: edición parcial; la mezcla con la fila actual se valida completa. */
  async updatePlan(id: string, input: UpdatePlanDto): Promise<PlanResponseDto> {
    return this.repo.transaction(async (tx) => {
      const existing = await this.repo.findPlanById(tx, id);
      if (!existing) {
        throw new DomainError('NOT_FOUND', 'El plan no existe.');
      }
      const draft = assertValidPlan({
        name: input.name === undefined ? existing.name : input.name,
        type: input.type === undefined ? existing.type : input.type,
        priceUsd:
          input.priceUsd === undefined
            ? existing.priceUsd.toFixed(2)
            : input.priceUsd,
        durationMonths:
          input.durationMonths === undefined
            ? existing.durationMonths
            : input.durationMonths,
        durationDays:
          input.durationDays === undefined
            ? existing.durationDays
            : input.durationDays,
        classCredits:
          input.classCredits === undefined
            ? existing.credits
            : input.classCredits,
        benefits:
          input.benefits === undefined ? existing.benefits : input.benefits,
        status: input.status === undefined ? existing.status : input.status,
      });
      const duplicated = await this.repo.findPlanIdByName(tx, draft.name);
      if (duplicated && duplicated !== id) {
        throw new DomainError('CONFLICT', 'Ya existe un plan con ese nombre.');
      }
      const row = await this.repo.updatePlan(tx, id, toWriteValues(draft));
      return PlanResponseDto.fromRow(row);
    });
  }

  /**
   * H2: registra la solicitud y su cobro `PENDIENTE`. El monto se toma del plan,
   * nunca del cliente, y la vigencia sólo se escribe cuando el cobro paga.
   */
  async request(
    memberNumber: string,
    planId: string,
    operation: MembershipOperation,
    actorId: string,
    membershipId?: string,
  ): Promise<PurchaseResponseDto | RenewalResponseDto> {
    return this.repo.transaction((tx) =>
      this.requestIn(
        tx,
        memberNumber,
        planId,
        operation,
        actorId,
        membershipId,
      ),
    );
  }

  /** H2: renovación por identificador de membresa. */
  async requestByMembership(
    membershipId: string,
    planId: string,
    actorId: string,
  ): Promise<RenewalResponseDto> {
    const memberNumber =
      await this.repo.findMemberNumberByMembership(membershipId);
    if (!memberNumber) {
      throw new DomainError('NOT_FOUND', 'La membresía no existe.');
    }
    const request = await this.request(
      memberNumber,
      planId,
      MEMBERSHIP_OPERATIONS[1],
      actorId,
      membershipId,
    );
    return request as RenewalResponseDto;
  }

  private async requestIn(
    tx: WriteClient,
    memberNumber: string,
    planId: string,
    operation: MembershipOperation,
    actorId: string,
    membershipId?: string,
  ): Promise<PurchaseResponseDto | RenewalResponseDto> {
    const memberId = await this.repo.findMemberIdByNumber(tx, memberNumber);
    if (!memberId) {
      throw new DomainError('NOT_FOUND', 'Miembro no encontrado.');
    }
    const plan = await this.repo.findPlanById(tx, planId);
    if (!plan) {
      throw new DomainError('NOT_FOUND', 'El plan no existe.');
    }
    if (plan.status !== PlanStatus.ACTIVO) {
      throw new DomainError(
        'CONFLICT',
        'El plan seleccionado no está disponible.',
      );
    }
    if (Number(plan.priceUsd.toFixed(2)) <= 0) {
      throw new DomainError(
        'INVALID',
        'El precio cero no puede generar un cobro de membresía.',
      );
    }

    const today = this.clock.today();
    const cards = await this.repo.findCardsTx(tx, memberId);
    const eligible = cards.filter((card) => isMembershipEligible(card, today));

    if (operation === 'COMPRA' && eligible.length > 0) {
      throw new DomainError(
        'CONFLICT',
        'El miembro ya tiene una membresía vigente. Seleccione la opción Renovación.',
      );
    }
    const current =
      operation === 'RENOVACION'
        ? cards.find((card) => card.id === membershipId)
        : undefined;
    if (operation === 'RENOVACION' && !current) {
      throw new DomainError(
        'CONFLICT',
        'La membresía no existe para este miembro o no permite renovación.',
      );
    }
    const pending = await this.repo.findPendingRequestId(tx, memberId);
    if (pending) {
      throw new DomainError(
        'CONFLICT',
        'Ya existe una solicitud pendiente para este miembro.',
      );
    }

    const paymentId = await this.repo.createCharge(tx, {
      memberId,
      amountUsd: plan.priceUsd.toFixed(2),
      dueDate: this.clock.now(),
    });

    let expectedStartsOn: string | null = null;
    let expectedEndsOn: string | null = null;
    if (current) {
      const duration = planDuration(plan);
      const continuation = isMembershipEligible(current, today);
      const expected = renewalPeriod(
        continuation ? current : null,
        duration,
        today,
      );
      expectedStartsOn = expected.startsOn;
      expectedEndsOn = expected.endsOn;
    }

    const requestId = await this.repo.createRequest(tx, {
      memberId,
      membershipId: current ? current.id : null,
      planId: plan.id,
      paymentId,
      operation,
      expectedStartsOn: expectedStartsOn ? dayValue(expectedStartsOn) : null,
      expectedEndsOn: expectedEndsOn ? dayValue(expectedEndsOn) : null,
      createdById: actorId,
    });

    if (!current) {
      const dto = new PurchaseResponseDto();
      dto.requestId = requestId;
      dto.paymentId = paymentId;
      dto.status = PENDING_PAYMENT;
      dto.startsOn = null;
      dto.endsOn = null;
      return dto;
    }

    const renewal = new RenewalResponseDto();
    renewal.requestId = requestId;
    renewal.membershipId = current.id;
    renewal.paymentId = paymentId;
    renewal.status = PENDING_PAYMENT;
    renewal.expectedEndsOn = expectedEndsOn as string;
    return renewal;
  }

  /**
   * H2 (criterios 7-9): aplica la solicitud cuando el cobro queda PAGADO.
   *
   * Lo invoca el Módulo 5 dentro de su propia transacción: jamás acepta un
   * estado enviado por el cliente, vuelve a leer el pago y es idempotente
   * porque una solicitud `APLICADA` no se procesa dos veces.
   */
  async applyPaidRequestTx(
    tx: WriteClient,
    paymentId: string,
    confirmedAt: Date,
  ): Promise<{ membershipId: string; startsOn: string; endsOn: string }> {
    const request = await this.repo.findRequestByPayment(tx, paymentId);
    if (!request) {
      throw new DomainError(
        'NOT_FOUND',
        'Solicitud de membresía no encontrada.',
      );
    }
    if (request.status !== PENDING_PAYMENT) {
      throw new DomainError('CONFLICT', 'La solicitud ya fue procesada.');
    }
    if (request.payment.status !== PaymentStatus.PAGADO) {
      throw new DomainError(
        'CONFLICT',
        'Solo un cobro PAGADO puede activar la membresía.',
      );
    }
    if (
      request.payment.memberId !== request.memberId ||
      request.payment.concept !== 'MEMBRESIA'
    ) {
      throw new DomainError(
        'CONFLICT',
        'El cobro no corresponde a la solicitud de membresía.',
      );
    }

    const today = this.clock.dateOf(confirmedAt);
    const plan = planDuration(request.plan);
    const current = request.membershipId
      ? await this.repo.findCardTx(tx, request.membershipId)
      : null;
    if (request.operation === 'RENOVACION' && !current) {
      throw new DomainError(
        'CONFLICT',
        'La renovación referencia una membresía inexistente; no se creará una compra nueva.',
      );
    }
    if (current && current.memberId !== request.memberId) {
      throw new DomainError(
        'CONFLICT',
        'La membresía no pertenece al miembro de la solicitud.',
      );
    }

    const continuation =
      request.operation === 'RENOVACION' &&
      current !== null &&
      isMembershipEligible(current, today);
    const period =
      request.operation === 'RENOVACION'
        ? renewalPeriod(continuation ? current : null, plan, today)
        : newPeriod(today, plan);
    const status = periodStatus(period, plan, today);
    const aggregateStartsOn =
      continuation && current ? civilDay(current.startsOn) : period.startsOn;
    const data = {
      memberId: request.memberId,
      planId: request.planId,
      paymentId,
      startsOn: dayValue(aggregateStartsOn),
      endsOn: dayValue(period.endsOn),
      creditsRemaining: period.creditsRemaining,
      status,
    };

    let membershipId: string;
    if (request.operation === 'RENOVACION' && current) {
      const previousState: MembershipPreviousState = {
        membershipId: current.id,
        memberId: current.memberId,
        planId: current.planId,
        paymentId: current.paymentId,
        startsOn: civilDay(current.startsOn),
        endsOn: civilDay(current.endsOn),
        creditsRemaining: current.creditsRemaining,
        status: current.status,
      };
      await this.repo.savePreviousState(tx, request.id, previousState);
      await this.repo.ensureMembershipPeriodSnapshot(tx, {
        membershipId: current.id,
        memberId: current.memberId,
        planId: current.planId,
        paymentId: current.paymentId,
        startsOn: current.startsOn,
        endsOn: current.endsOn,
        creditsGranted: current.creditsRemaining,
      });
      membershipId = await this.repo.renewMembership(tx, {
        ...data,
        startsOn: dayValue(aggregateStartsOn),
        membershipId: current.id,
      });
    } else {
      membershipId = await this.repo.createMembership(tx, data);
    }

    await this.repo.createMembershipPeriod(tx, {
      membershipId,
      memberId: request.memberId,
      planId: request.planId,
      paymentId,
      startsOn: dayValue(period.startsOn),
      endsOn: dayValue(period.endsOn),
      creditsGranted: period.creditsRemaining,
    });

    await this.repo.markRequestApplied(
      tx,
      request.id,
      membershipId,
      confirmedAt,
    );
    return {
      membershipId,
      startsOn: period.startsOn,
      endsOn: period.endsOn,
    };
  }

  /** Variante autónoma para reintentos programados del reconciliador. */
  async applyPaidRequest(
    paymentId: string,
    confirmedAt: Date,
  ): Promise<{ membershipId: string; startsOn: string; endsOn: string }> {
    return this.repo.transaction((tx) =>
      this.applyPaidRequestTx(tx, paymentId, confirmedAt),
    );
  }

  /** H21: tarifa del plan original, incluso si actualmente está INACTIVO. */
  async getReplacementAmountTx(
    tx: WriteClient,
    paymentId: string,
  ): Promise<string> {
    const amount = await this.repo.findReplacementAmountTx(tx, paymentId);
    if (amount === null) {
      throw new DomainError(
        'NOT_FOUND',
        'No se puede determinar el plan del cobro de membresía.',
      );
    }
    return amount;
  }

  /**
   * H21: revierte una aplicación de membresía después de anular el pago
   * original y crear el reemplazo PENDIENTE. Todo corre en la transacción del
   * módulo de pagos; nunca convierte una renovación huérfana en una compra.
   */
  async reversePaidRequestTx(
    tx: WriteClient,
    oldPaymentId: string,
    newPaymentId: string,
    actorId: string,
    now: Date,
  ): Promise<void> {
    if (oldPaymentId === newPaymentId) {
      throw new DomainError(
        'INVALID',
        'El cobro de reemplazo debe ser distinto.',
      );
    }
    const request = await this.repo.findRequestByPayment(tx, oldPaymentId);
    if (!request) {
      throw new DomainError(
        'NOT_FOUND',
        'Solicitud de membresía no encontrada.',
      );
    }
    if (request.status !== 'APLICADA') {
      throw new DomainError(
        'CONFLICT',
        'Solo se puede revertir una solicitud de membresía aplicada.',
      );
    }
    if (!request.membershipId) {
      throw new DomainError(
        'CONFLICT',
        'La solicitud aplicada no tiene membresía para revertir.',
      );
    }

    const today = this.clock.dateOf(now);
    let replacementMembershipId: string | null = null;
    if (request.operation === 'RENOVACION') {
      const previousState = await this.repo.findPreviousState(tx, oldPaymentId);
      if (
        !previousState ||
        previousState.membershipId !== request.membershipId
      ) {
        throw new DomainError(
          'CONFLICT',
          'La renovación no tiene estado previo para revertirse de forma segura.',
        );
      }
      await this.repo.restoreMembership(tx, previousState);
      const restored = await this.repo.findCardTx(
        tx,
        previousState.membershipId,
      );
      if (!restored) {
        throw new DomainError(
          'CONFLICT',
          'No se pudo recuperar la membresía previa de la renovación.',
        );
      }
      const reevaluated = membershipStatusLabel(restored, today);
      if (reevaluated !== restored.status) {
        await this.repo.setMembershipStatus(tx, restored.id, reevaluated);
      }
      replacementMembershipId = restored.id;
    } else if (request.operation === 'COMPRA') {
      await this.repo.setMembershipStatus(
        tx,
        request.membershipId,
        MembershipStatus.VENCIDA,
      );
    } else {
      throw new DomainError(
        'CONFLICT',
        'Operación de membresía no reversible.',
      );
    }

    await this.repo.cancelRequest(tx, request.id);

    let expectedStartsOn: Date | null = null;
    let expectedEndsOn: Date | null = null;
    if (replacementMembershipId) {
      const restored = await this.repo.findCardTx(tx, replacementMembershipId);
      const continuation = restored && isMembershipEligible(restored, today);
      const expected = renewalPeriod(
        continuation ? restored : null,
        planDuration(request.plan),
        today,
      );
      expectedStartsOn = dayValue(expected.startsOn);
      expectedEndsOn = dayValue(expected.endsOn);
    }
    await this.repo.createRequest(tx, {
      memberId: request.memberId,
      membershipId: replacementMembershipId,
      planId: request.planId,
      paymentId: newPaymentId,
      operation: request.operation as MembershipOperation,
      expectedStartsOn,
      expectedEndsOn,
      createdById: actorId,
    });
  }

  /**
   * Vencimientos diarios (persistencia del estado que lee H31).
   *
   * Idempotente: sólo toca filas hoy VIGENTE cuyo estado canónico ya es
   * VENCIDA (fecha superada o créditos agotados en planes POR_CLASES).
   */
  async expireOverdue(): Promise<number> {
    const today = this.clock.today();
    const vigente = await this.repo.findVigenteCards();
    const dueIds = vigente
      .filter(
        (row) => membershipStatusLabel(row, today) === MembershipStatus.VENCIDA,
      )
      .map((row) => row.id);
    if (dueIds.length === 0) {
      return 0;
    }
    return this.repo.transaction((tx) => this.repo.markVencidas(tx, dueIds));
  }
}

/** Draft validado → valores de escritura, con el tipo exacto de Prisma. */
function toWriteValues(draft: PlanDraft): PlanWriteValues {
  return {
    name: draft.name,
    type: draft.type,
    priceUsd: new Prisma.Decimal(draft.priceUsd),
    durationMonths: draft.durationMonths,
    durationDays: draft.durationDays,
    credits: draft.classCredits,
    benefits: draft.benefits,
    status: draft.status,
  };
}
