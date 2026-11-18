import { describe, expect, it } from 'vitest';
import { ReservationStatus } from '@PrismaClient';
import { DomainError } from '@Common/errors';
import {
  assertCancelWindowOpen,
  assertCancellableByMember,
  computeFreeSpots,
  shouldRestoreCredit,
} from './reservation-rules.js';
describe('reglas H6', () => {
  it('acepta la frontera exacta de 12 horas y rechaza el milisegundo siguiente', () => {
    const now = new Date('2026-11-11T00:00:00Z');
    expect(() =>
      assertCancelWindowOpen(new Date(now.getTime() + 12 * 3600000), now),
    ).not.toThrow();
    expect(() =>
      assertCancelWindowOpen(new Date(now.getTime() + 12 * 3600000 - 1), now),
    ).toThrow(DomainError);
  });
  it('diferencia cancelación por gimnasio de la segunda cancelación', () => {
    expect(() =>
      assertCancellableByMember(ReservationStatus.CANCELADA_POR_GIMNASIO),
    ).toThrow('El gimnasio canceló esta reserva');
    expect(() =>
      assertCancellableByMember(ReservationStatus.CANCELADA),
    ).toThrow('La reserva ya está cancelada');
  });
  it('calcula plazas no negativas y devuelve crédito una sola vez', () => {
    expect(computeFreeSpots(8, 7)).toBe(1);
    expect(computeFreeSpots(8, 10)).toBe(0);
    expect(
      shouldRestoreCredit({
        membershipId: 'm',
        creditConsumed: true,
        creditRefunded: false,
      }),
    ).toBe(true);
    expect(
      shouldRestoreCredit({
        membershipId: 'm',
        creditConsumed: true,
        creditRefunded: true,
      }),
    ).toBe(false);
  });
});
