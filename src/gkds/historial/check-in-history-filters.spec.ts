
import { describe, expect, it } from 'vitest';
import { buildHistoryFilters } from './check-in-history-filters.js';

const today = new Date('2026-11-08T12:00:00Z');

describe('H15 - Filtros del historial de ingresos', () => {
  it('utiliza los últimos 30 días por defecto', () => {
    const result = buildHistoryFilters({}, today);

    expect(result.from.toISOString().slice(0, 10))
      .toBe('2026-10-10');
    expect(result.to.toISOString().slice(0, 10))
      .toBe('2026-11-08');
  });

  it('acepta un rango de fechas válido', () => {
    const result = buildHistoryFilters({
      from: '2026-11-01',
      to: '2026-11-08',
    }, today);

    expect(result.from.toISOString().slice(0, 10))
      .toBe('2026-11-01');
  });

  it('rechaza fechas invertidas', () => {
    expect(() => buildHistoryFilters({
      from: '2026-11-08',
      to: '2026-11-01',
    }, today)).toThrow();
  });

  it('rechaza rangos superiores a 90 días', () => {
    expect(() => buildHistoryFilters({
      from: '2026-01-01',
      to: '2026-11-08',
    }, today)).toThrow();
  });

  it('rechaza fechas inexistentes', () => {
    expect(() => buildHistoryFilters({
      from: '2026-02-30',
      to: '2026-11-08',
    }, today)).toThrow();
  });

  it('calcula la paginación correctamente', () => {
    const result = buildHistoryFilters({
      page: 3,
      pageSize: 10,
    }, today);

    expect(result.skip).toBe(20);
    expect(result.pageSize).toBe(10);
  });

  it('rechaza tamaños de página superiores a 20', () => {
    expect(() => buildHistoryFilters({
      pageSize: 50,
    }, today)).toThrow();
  });

  it('permite filtrar por número de miembro', () => {
    const result = buildHistoryFilters({
      memberNumber: ' GKDS-001 ',
    }, today);

    expect(result.memberNumber).toBe('GKDS-001');
  });
});
