import { describe, expect, it } from 'vitest';
import {
  civilDay,
  hasExpiredOn,
  isMembershipEligible,
  isPaidMembershipCharge,
  membershipStatusLabel,
  selectCurrentMembership,
  type EligibilityInput,
} from './eligibility.js';

const MEMBER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

function membership(
  overrides: Partial<EligibilityInput> = {},
): EligibilityInput {
  return {
    startsOn: new Date('2026-01-01T00:00:00.000Z'),
    endsOn: new Date('2026-01-31T00:00:00.000Z'),
    creditsRemaining: null,
    plan: { type: 'MONTHLY' },
    payment: { status: 'PAGADO', memberId: MEMBER, concept: 'MEMBRESIA' },
    memberId: MEMBER,
    ...overrides,
  };
}

describe('isMembershipEligible (regla canónica H1/H14)', () => {
  it('exige el rango inclusivo de fechas', () => {
    expect(isMembershipEligible(membership(), '2026-01-01')).toBe(true);
    expect(isMembershipEligible(membership(), '2026-01-31')).toBe(true);
    expect(isMembershipEligible(membership(), '2025-12-31')).toBe(false);
    expect(isMembershipEligible(membership(), '2026-02-01')).toBe(false);
  });

  it('exige un cobro MEMBRESIA PAGADO del propio miembro', () => {
    expect(
      isMembershipEligible(
        membership({
          payment: {
            status: 'PENDIENTE',
            memberId: MEMBER,
            concept: 'MEMBRESIA',
          },
        }),
        '2026-01-15',
      ),
    ).toBe(false);
    expect(
      isMembershipEligible(
        membership({
          payment: {
            status: 'PAGADO',
            memberId: MEMBER,
            concept: 'SESION_PERSONAL',
          },
        }),
        '2026-01-15',
      ),
    ).toBe(false);
    expect(
      isMembershipEligible(
        membership({
          payment: { status: 'PAGADO', memberId: OTHER, concept: 'MEMBRESIA' },
        }),
        '2026-01-15',
      ),
    ).toBe(false);
    expect(isPaidMembershipCharge(membership())).toBe(true);
  });

  it('vence un plan POR_CLASES sin créditos aunque la fecha siga vigente', () => {
    const byClasses = membership({
      plan: { type: 'BY_CLASSES' },
      creditsRemaining: 0,
    });
    expect(isMembershipEligible(byClasses, '2026-01-15')).toBe(false);
    expect(
      isMembershipEligible(
        membership({ plan: { type: 'BY_CLASSES' }, creditsRemaining: 1 }),
        '2026-01-15',
      ),
    ).toBe(true);
  });
});

describe('membershipStatusLabel (etiqueta VIGENTE/VENCIDA)', () => {
  it('marca VENCIDA una membresía pagada que aún no comienza', () => {
    const future = membership({
      startsOn: new Date('2026-12-01T00:00:00.000Z'),
      endsOn: new Date('2026-12-31T00:00:00.000Z'),
    });
    expect(isMembershipEligible(future, '2026-11-11')).toBe(false);
    expect(membershipStatusLabel(future, '2026-11-11')).toBe('VENCIDA');
  });

  it('marca VENCIDA por fecha, por créditos o por cobro no pagado', () => {
    expect(membershipStatusLabel(membership(), '2026-02-01')).toBe('VENCIDA');
    expect(
      membershipStatusLabel(
        membership({ plan: { type: 'BY_CLASSES' }, creditsRemaining: 0 }),
        '2026-01-15',
      ),
    ).toBe('VENCIDA');
    expect(
      membershipStatusLabel(
        membership({
          payment: {
            status: 'ANULADO',
            memberId: MEMBER,
            concept: 'MEMBRESIA',
          },
        }),
        '2026-01-15',
      ),
    ).toBe('VENCIDA');
    expect(membershipStatusLabel(membership(), '2026-01-15')).toBe('VIGENTE');
  });
});

describe('civilDay y hasExpiredOn', () => {
  it('trata las columnas @db.Date como fechas civiles UTC', () => {
    expect(civilDay(new Date('2026-01-31T00:00:00.000Z'))).toBe('2026-01-31');
    expect(hasExpiredOn(membership(), '2026-01-31')).toBe(false);
    expect(hasExpiredOn(membership(), '2026-02-01')).toBe(true);
  });
});

describe('selectCurrentMembership (contrato H1)', () => {
  it('devuelve null sin inventar fechas cuando no hay filas', () => {
    expect(selectCurrentMembership([], '2026-11-11')).toBeNull();
  });

  it('prioriza la membresa que cubre hoy sobre la más reciente', () => {
    const covering = membership({
      startsOn: new Date('2026-11-01T00:00:00.000Z'),
      endsOn: new Date('2026-11-30T00:00:00.000Z'),
    });
    const older = membership({
      startsOn: new Date('2026-10-01T00:00:00.000Z'),
      endsOn: new Date('2026-10-31T00:00:00.000Z'),
    });
    expect(selectCurrentMembership([older, covering], '2026-11-11')).toBe(
      covering,
    );
  });

  it('cae a la más reciente cuando ninguna cubre hoy', () => {
    const expired = membership({
      endsOn: new Date('2026-10-31T00:00:00.000Z'),
    });
    const future = membership({
      startsOn: new Date('2026-12-01T00:00:00.000Z'),
      endsOn: new Date('2026-12-31T00:00:00.000Z'),
    });
    const chosen = selectCurrentMembership([expired, future], '2026-11-11');
    expect(chosen).toBe(future);
    expect(membershipStatusLabel(chosen!, '2026-11-11')).toBe('VENCIDA');
  });
});
