import { describe, expect, it, vi } from 'vitest';
import {
  capEvolutionPoints,
  ProgressRecordRepository,
} from './progress-record.repository.js';
import type { EvolutionPoint } from '../progress-views.js';

function points(count: number): EvolutionPoint[] {
  return Array.from({ length: count }, (_unused, index) => ({
    date: `2026-01-${String(index + 1).padStart(2, '0')}`,
    value: index,
    reps: null,
  }));
}

describe('capEvolutionPoints (H25)', () => {
  it('limita historiales largos a 365 puntos conservando baseline y latest', () => {
    const source = points(400);
    const result = capEvolutionPoints(source);

    expect(result).toHaveLength(365);
    expect(result[0]).toEqual(source[0]);
    expect(result.at(-1)).toEqual(source.at(-1));
    expect(result.map((point) => point.value)).toEqual(
      capEvolutionPoints(source).map((point) => point.value),
    );
  });

  it('no altera una serie que ya está dentro del límite', () => {
    const source = points(365);
    expect(capEvolutionPoints(source)).toBe(source);
  });

  it('calcula baseline/latest con el primer dato real aunque el historial supere 366 filas', async () => {
    const rows = Array.from({ length: 400 }, (_unused, index) => ({
      recordDate: new Date(Date.UTC(2024, 0, index + 1)),
      weightKg: 80,
      waistCm: index === 0 ? null : index,
      chestCm: null,
      armCm: null,
    }));
    const findMany = vi.fn().mockResolvedValue(rows);
    const repository = new ProgressRecordRepository({
      progressRecord: { findMany },
    } as never);

    const result = await repository.evolution(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'waistCm',
      undefined,
      null,
      null,
    );

    expect(findMany.mock.calls[0][0].take).toBeUndefined();
    expect(result.points).toHaveLength(365);
    expect(result.baseline).toBe(1);
    expect(result.latest).toBe(399);
    expect(result.difference).toBe(398);
    expect(result.points[0].value).toBe(1);
    expect(result.points.at(-1)?.value).toBe(399);
  });
});
