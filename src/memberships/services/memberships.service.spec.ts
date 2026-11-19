import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MembershipsService } from './memberships.service.js';

const MEMBER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PLAN_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const PAYMENT_ID = 'fffffffe-ffff-4fff-8fff-ffffffffffff';
const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const MEMBERSHIP_ID = '22222222-2222-4222-8222-222222222222';
const ACTOR_ID = '33333333-3333-4333-8333-333333333333';

const TODAY = '2026-11-11';
const CONFIRMED_AT = new Date('2026-11-11T15:00:00Z');

const clock = {
  today: () => TODAY,
  now: () => new Date(`${TODAY}T15:00:00Z`),
  dateOf: (instant: Date) => instant.toISOString().slice(0, 10),
};

function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
    name: 'Anual',
    type: 'ANUAL',
    priceUsd: { toFixed: () => '120.00' },
    durationMonths: 12,
    durationDays: null,
    credits: null,
    benefits: '[]',
    status: 'ACTIVO',
    ...overrides,
  };
}

function card(overrides: Record<string, unknown> = {}) {
  return {
    id: MEMBERSHIP_ID,
    memberId: MEMBER,
    startsOn: new Date('2026-01-01T00:00:00Z'),
    endsOn: new Date('2026-12-31T00:00:00Z'),
    creditsRemaining: null,
    status: 'VIGENTE',
    plan: { id: PLAN_ID, name: 'Anual', type: 'ANUAL', benefits: '[]' },
    payment: { status: 'PAGADO', memberId: MEMBER, concept: 'MEMBRESIA' },
    ...overrides,
  };
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    memberId: MEMBER,
    membershipId: null,
    planId: PLAN_ID,
    paymentId: PAYMENT_ID,
    operation: 'COMPRA',
    status: 'PENDIENTE_PAGO',
    expectedStartsOn: null,
    expectedEndsOn: null,
    plan: plan(),
    payment: { status: 'PAGADO', memberId: MEMBER, concept: 'MEMBRESIA' },
    ...overrides,
  };
}

function setup(overrides: Record<string, unknown> = {}) {
  const repo = {
    transaction: vi.fn((work: (tx: object) => Promise<unknown>) => work({})),
    findMemberIdByNumber: vi.fn().mockResolvedValue(MEMBER),
    findPlanById: vi.fn().mockResolvedValue(plan()),
    findCardsTx: vi.fn().mockResolvedValue([]),
    findPendingRequestId: vi.fn().mockResolvedValue(null),
    createCharge: vi.fn().mockResolvedValue(PAYMENT_ID),
    createRequest: vi.fn().mockResolvedValue(REQUEST_ID),
    findRequestByPayment: vi.fn().mockResolvedValue(request()),
    findCardTx: vi.fn().mockResolvedValue(card()),
    findReplacementAmountTx: vi.fn().mockResolvedValue('120.00'),
    findPreviousState: vi.fn().mockResolvedValue(null),
    savePreviousState: vi.fn().mockResolvedValue(undefined),
    ensureMembershipPeriodSnapshot: vi.fn().mockResolvedValue(undefined),
    createMembershipPeriod: vi.fn().mockResolvedValue(undefined),
    restoreMembership: vi.fn().mockResolvedValue(undefined),
    setMembershipStatus: vi.fn().mockResolvedValue(undefined),
    cancelRequest: vi.fn().mockResolvedValue(undefined),
    createMembership: vi.fn().mockResolvedValue(MEMBERSHIP_ID),
    renewMembership: vi.fn().mockResolvedValue(MEMBERSHIP_ID),
    markRequestApplied: vi.fn().mockResolvedValue(undefined),
    findCards: vi.fn().mockResolvedValue([]),
    findVigenteCards: vi.fn().mockResolvedValue([]),
    markVencidas: vi.fn().mockResolvedValue(0),
    findMemberNumberByMembership: vi.fn().mockResolvedValue('M-0007'),
    ...overrides,
  };
  return {
    service: new MembershipsService(repo as never, clock as never),
    repo,
  };
}

describe('MembershipsService (H2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registra la solicitud con cobro pendiente y sin fechas de vigencia', async () => {
    const { service, repo } = setup();
    const dto = await service.request('M-0007', PLAN_ID, 'COMPRA', ACTOR_ID);
    expect(dto).toMatchObject({
      requestId: REQUEST_ID,
      paymentId: PAYMENT_ID,
      status: 'PENDIENTE_PAGO',
      startsOn: null,
      endsOn: null,
    });
    const charge = repo.createCharge.mock.calls[0][1] as { amountUsd: string };
    expect(charge.amountUsd).toBe('120.00');
  });

  it('no inventa la membresa: un miembro inexistente responde 404', async () => {
    const { service, repo } = setup({
      findMemberIdByNumber: vi.fn().mockResolvedValue(null),
    });
    await expect(
      service.request('M-9999', PLAN_ID, 'COMPRA', ACTOR_ID),
    ).rejects.toMatchObject({ kind: 'NOT_FOUND' });
    expect(repo.createCharge).not.toHaveBeenCalled();
  });

  it('rechaza un plan inactivos con 409 antes de crear el cobro', async () => {
    const { service, repo } = setup({
      findPlanById: vi.fn().mockResolvedValue(plan({ status: 'INACTIVO' })),
    });
    await expect(
      service.request('M-0007', PLAN_ID, 'COMPRA', ACTOR_ID),
    ).rejects.toMatchObject({ kind: 'CONFLICT' });
    expect(repo.createCharge).not.toHaveBeenCalled();
  });

  it('rechaza precio cero con error de dominio antes de crear el cobro', async () => {
    const { service, repo } = setup({
      findPlanById: vi
        .fn()
        .mockResolvedValue(plan({ priceUsd: { toFixed: () => '0.00' } })),
    });
    await expect(
      service.request('M-0007', PLAN_ID, 'COMPRA', ACTOR_ID),
    ).rejects.toMatchObject({ kind: 'INVALID' });
    expect(repo.createCharge).not.toHaveBeenCalled();
  });

  it('impide una segunda compra cuando ya hay cobertura vigente', async () => {
    const { service, repo } = setup({
      findCardsTx: vi.fn().mockResolvedValue([card()]),
    });
    await expect(
      service.request('M-0007', PLAN_ID, 'COMPRA', ACTOR_ID),
    ).rejects.toMatchObject({
      kind: 'CONFLICT',
      message: expect.stringContaining('Renovación'),
    });
    expect(repo.createCharge).not.toHaveBeenCalled();
  });

  it('permite renovar una membresa vencida y empieza el nuevo tramo hoy', async () => {
    const { service, repo } = setup({
      findCardsTx: vi
        .fn()
        .mockResolvedValue([
          card({ endsOn: new Date('2026-10-01T00:00:00Z') }),
        ]),
    });
    const result = await service.request(
      'M-0007',
      PLAN_ID,
      'RENOVACION',
      ACTOR_ID,
      MEMBERSHIP_ID,
    );
    const data = repo.createRequest.mock.calls[0][1] as {
      expectedStartsOn: Date;
    };
    expect(data.expectedStartsOn.toISOString().slice(0, 10)).toBe(TODAY);
    expect(result).toMatchObject({ status: 'PENDIENTE_PAGO' });
  });

  it('rechaza duplicar una solicitud pendiente', async () => {
    const { service, repo } = setup({
      findPendingRequestId: vi.fn().mockResolvedValue(REQUEST_ID),
    });
    await expect(
      service.request('M-0007', PLAN_ID, 'COMPRA', ACTOR_ID),
    ).rejects.toMatchObject({ kind: 'CONFLICT' });
    expect(repo.createRequest).not.toHaveBeenCalled();
    expect(repo.createCharge).not.toHaveBeenCalled();
  });

  it('en la renovación el tramo nuevo arranca el día después del vencimiento actual', async () => {
    const { service, repo } = setup({
      findCardsTx: vi.fn().mockResolvedValue([card()]),
    });
    const dto = await service.request(
      'M-0007',
      PLAN_ID,
      'RENOVACION',
      ACTOR_ID,
      MEMBERSHIP_ID,
    );
    const data = repo.createRequest.mock.calls[0][1] as Record<string, unknown>;
    expect(data.membershipId).toBe(MEMBERSHIP_ID);
    expect((data.expectedStartsOn as Date).toISOString().slice(0, 10)).toBe(
      '2027-01-01',
    );
    expect((data.expectedEndsOn as Date).toISOString().slice(0, 10)).toBe(
      '2027-12-31',
    );
    expect(dto).toMatchObject({
      expectedEndsOn: '2027-12-31',
      status: 'PENDIENTE_PAGO',
    });
  });

  it('renueva por id de membresa leyendo el número del miembro', async () => {
    const { service, repo } = setup({
      findCardsTx: vi.fn().mockResolvedValue([card()]),
    });
    await service.requestByMembership(MEMBERSHIP_ID, PLAN_ID, ACTOR_ID);
    expect(repo.findMemberNumberByMembership).toHaveBeenCalledWith(
      MEMBERSHIP_ID,
    );
    const call = repo.createRequest.mock.calls[0][1] as Record<string, unknown>;
    expect(call.operation).toBe('RENOVACION');
  });
});

describe('MembershipsService (H2, activación por cobro pagado)', () => {
  const paidSetup = (overrides: Record<string, unknown> = {}) =>
    setup({
      findRequestByPayment: vi.fn().mockResolvedValue(request()),
      ...overrides,
    });

  it('exige que la solicitud exista', async () => {
    const { service } = paidSetup({
      findRequestByPayment: vi.fn().mockResolvedValue(null),
    });
    await expect(
      service.applyPaidRequestTx({} as never, PAYMENT_ID, CONFIRMED_AT),
    ).rejects.toMatchObject({ kind: 'NOT_FOUND' });
  });

  it('es idempotente: una solicitud aplicada no vuelve a crear nada', async () => {
    const { service, repo } = paidSetup({
      findRequestByPayment: vi
        .fn()
        .mockResolvedValue(request({ status: 'APLICADA' })),
    });
    await expect(
      service.applyPaidRequestTx({} as never, PAYMENT_ID, CONFIRMED_AT),
    ).rejects.toMatchObject({ kind: 'CONFLICT' });
    expect(repo.createMembership).not.toHaveBeenCalled();
    expect(repo.markRequestApplied).not.toHaveBeenCalled();
  });

  it('rechaza activar con un cobro que no está pagado', async () => {
    const { service, repo } = paidSetup({
      findRequestByPayment: vi
        .fn()
        .mockResolvedValue(
          request({
            payment: {
              status: 'PENDIENTE',
              memberId: MEMBER,
              concept: 'MEMBRESIA',
            },
          }),
        ),
    });
    await expect(
      service.applyPaidRequestTx({} as never, PAYMENT_ID, CONFIRMED_AT),
    ).rejects.toMatchObject({ kind: 'CONFLICT' });
    expect(repo.createMembership).not.toHaveBeenCalled();
  });

  it('rechaza una renovación huérfana sin crear una compra silenciosa', async () => {
    const { service, repo } = paidSetup({
      findRequestByPayment: vi
        .fn()
        .mockResolvedValue(
          request({ operation: 'RENOVACION', membershipId: MEMBERSHIP_ID }),
        ),
      findCardTx: vi.fn().mockResolvedValue(null),
    });
    await expect(
      service.applyPaidRequestTx({} as never, PAYMENT_ID, CONFIRMED_AT),
    ).rejects.toMatchObject({ kind: 'CONFLICT' });
    expect(repo.createMembership).not.toHaveBeenCalled();
    expect(repo.renewMembership).not.toHaveBeenCalled();
  });

  it('alta la membresa con el período que empieza en la fecha de confirmación', async () => {
    const { service, repo } = paidSetup();
    const result = await service.applyPaidRequestTx(
      {} as never,
      PAYMENT_ID,
      CONFIRMED_AT,
    );
    const data = repo.createMembership.mock.calls[0][1] as {
      startsOn: Date;
      endsOn: Date;
      status: string;
    };
    expect(data.startsOn.toISOString().slice(0, 10)).toBe('2026-11-11');
    expect(data.endsOn.toISOString().slice(0, 10)).toBe('2027-11-10');
    expect(data.status).toBe('VIGENTE');
    expect(result).toEqual({
      membershipId: MEMBERSHIP_ID,
      startsOn: '2026-11-11',
      endsOn: '2027-11-10',
    });
    expect(repo.markRequestApplied).toHaveBeenCalledWith(
      expect.anything(),
      REQUEST_ID,
      MEMBERSHIP_ID,
      CONFIRMED_AT,
    );
  });

  it('en la renovación conserva el inicio y extiende el vencimiento', async () => {
    const { service, repo } = paidSetup({
      findRequestByPayment: vi
        .fn()
        .mockResolvedValue(
          request({ operation: 'RENOVACION', membershipId: MEMBERSHIP_ID }),
        ),
    });
    await service.applyPaidRequestTx({} as never, PAYMENT_ID, CONFIRMED_AT);
    const data = repo.renewMembership.mock.calls[0][1] as {
      membershipId: string;
      startsOn: Date;
      endsOn: Date;
    };
    expect(data.membershipId).toBe(MEMBERSHIP_ID);
    expect(data.startsOn.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(data.endsOn.toISOString().slice(0, 10)).toBe('2027-12-31');
    expect(repo.createMembership).not.toHaveBeenCalled();
  });
});

describe('MembershipsService (H1 y vencimientos)', () => {
  it('sin membresa responde null, no un estado inventado', async () => {
    const { service } = setup();
    await expect(service.mine(MEMBER)).resolves.toEqual({ membership: null });
  });

  it('muestra la membresa vigente del miembro', async () => {
    const { service } = setup({
      findCards: vi.fn().mockResolvedValue([card()]),
    });
    const dto = await service.mine(MEMBER);
    expect(dto.membership).toMatchObject({
      id: MEMBERSHIP_ID,
      status: 'VIGENTE',
    });
  });

  it('ignora el cobro de otra persona o de otro concepto', async () => {
    const { service } = setup({
      findCards: vi
        .fn()
        .mockResolvedValue([
          card({
            payment: {
              status: 'PAGADO',
              memberId: ACTOR_ID,
              concept: 'MEMBRESIA',
            },
          }),
        ]),
    });
    await expect(service.mine(MEMBER)).resolves.toEqual({ membership: null });
  });

  it('sólo pasa a VENCIDA las filas que ya no cubren ni tienen créditos', async () => {
    const due = card({
      id: MEMBERSHIP_ID,
      endsOn: new Date('2026-11-01T00:00:00Z'),
    });
    const { service, repo } = setup({
      findVigenteCards: vi.fn().mockResolvedValue([due]),
    });
    repo.markVencidas.mockResolvedValue(1);
    await expect(service.expireOverdue()).resolves.toBe(1);
    expect(repo.markVencidas.mock.calls[0][1]).toEqual([MEMBERSHIP_ID]);
  });

  it('no abre transacción cuando nada venció', async () => {
    const { service, repo } = setup();
    await expect(service.expireOverdue()).resolves.toBe(0);
    expect(repo.transaction).not.toHaveBeenCalled();
  });
});
