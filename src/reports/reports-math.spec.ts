import { describe, expect, it } from 'vitest';
import { occupancyLabel, sortOccupancy } from './reports-math.js';

describe('occupancy report math', () => {
  it('breaks occupancy ties by reservations and then alphabetical name', () => {
    expect(
      sortOccupancy([
        { name: 'Zulu', occupancyPct: 50, confirmedReservations: 5 },
        { name: 'Beta', occupancyPct: 50, confirmedReservations: 7 },
        { name: 'Alpha', occupancyPct: 50, confirmedReservations: 7 },
      ]).map((row) => row.name),
    ).toEqual(['Alpha', 'Beta', 'Zulu']);
  });

  it('labels first and last three when there are at least six classes', () => {
    expect(
      Array.from({ length: 6 }, (_, index) => occupancyLabel(index, 6)),
    ).toEqual(['ALTA', 'ALTA', 'ALTA', 'BAJA', 'BAJA', 'BAJA']);
  });

  it('splits fewer than six classes and leaves an odd center unlabeled', () => {
    expect(
      Array.from({ length: 5 }, (_, index) => occupancyLabel(index, 5)),
    ).toEqual(['ALTA', 'ALTA', null, 'BAJA', 'BAJA']);
  });
});
