
import { describe, expect, it } from 'vitest';
import { validateCheckIn } from './check-in-validation.js';

const memberId = 'aeba9980-c011-4483-bd9a-73ee6c67ebc3';

describe('H13 - Validación de ingresos', () => {
  it('permite el ingreso con membresía vigente', () => {
    const result = validateCheckIn({
      memberId,
      membershipStatus: 'VIGENTE',
      alreadyCheckedInToday: false,
    });

    expect(result.allowed).toBe(true);
    expect(result.code).toBe('OK');
    expect(result.expiredConfirmed).toBe(false);
  });

  it('rechaza identificadores inválidos', () => {
    const result = validateCheckIn({
      memberId: '123',
      membershipStatus: 'VIGENTE',
      alreadyCheckedInToday: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('INVALID_MEMBER');
  });

  it('impide registrar dos ingresos el mismo día', () => {
    const result = validateCheckIn({
      memberId,
      membershipStatus: 'VIGENTE',
      alreadyCheckedInToday: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('ALREADY_CHECKED_IN');
  });

  it('solicita confirmación para membresía vencida', () => {
    const result = validateCheckIn({
      memberId,
      membershipStatus: 'VENCIDA',
      alreadyCheckedInToday: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('CONFIRMATION_REQUIRED');
  });

  it('permite ingreso vencido con confirmación', () => {
    const result = validateCheckIn({
      memberId,
      membershipStatus: 'VENCIDA',
      confirmExpired: true,
      alreadyCheckedInToday: false,
    });

    expect(result.allowed).toBe(true);
    expect(result.expiredConfirmed).toBe(true);
  });

  it('requiere confirmación si no tiene membresía', () => {
    const result = validateCheckIn({
      memberId,
      membershipStatus: 'SIN_MEMBRESIA',
      alreadyCheckedInToday: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('CONFIRMATION_REQUIRED');
  });

  it('permite ingreso sin membresía con confirmación', () => {
    const result = validateCheckIn({
      memberId,
      membershipStatus: 'SIN_MEMBRESIA',
      confirmExpired: true,
      alreadyCheckedInToday: false,
    });

    expect(result.allowed).toBe(true);
    expect(result.expiredConfirmed).toBe(true);
  });
});
