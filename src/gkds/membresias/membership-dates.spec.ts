
import { describe, expect, it } from 'vitest';

import {
  calculateMembershipPeriod,
  calculateRenewalStart,
} from './membership-dates.js';

describe('H2 - Fechas de membresías', () => {
  it('calcula un plan mensual', () => {
    const result = calculateMembershipPeriod(
      new Date('2026-11-03T00:00:00Z'),
      { type: 'MONTHLY', durationMonths: 1 },
    );

    expect(result.endsOn.toISOString().slice(0, 10)).toBe('2026-12-02');
  });

  it('calcula un plan trimestral', () => {
    const result = calculateMembershipPeriod(
      new Date('2026-11-03T00:00:00Z'),
      { type: 'QUARTERLY', durationMonths: 3 },
    );

    expect(result.endsOn.toISOString().slice(0, 10)).toBe('2027-02-02');
  });

  it('calcula un plan de diez días', () => {
    const result = calculateMembershipPeriod(
      new Date('2026-11-03T00:00:00Z'),
      { type: 'BY_CLASSES', durationDays: 10 },
    );

    expect(result.endsOn.toISOString().slice(0, 10)).toBe('2026-11-12');
  });

  it('rechaza duraciones inválidas', () => {
    expect(() =>
      calculateMembershipPeriod(
        new Date('2026-11-03T00:00:00Z'),
        { type: 'MONTHLY', durationMonths: 0 },
      ),
    ).toThrow();
  });

  it('renueva desde el día posterior al vencimiento', () => {
    const result = calculateRenewalStart(
      new Date('2026-11-03T00:00:00Z'),
      new Date('2026-12-02T00:00:00Z'),
    );

    expect(result.toISOString().slice(0, 10)).toBe('2026-12-03');
  });

  it('inicia inmediatamente si la membresía anterior venció', () => {
    const result = calculateRenewalStart(
      new Date('2026-11-03T00:00:00Z'),
      new Date('2026-10-20T00:00:00Z'),
    );

    expect(result.toISOString().slice(0, 10)).toBe('2026-11-03');
  });
});
