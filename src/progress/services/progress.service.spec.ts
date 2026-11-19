import { describe, expect, it, vi } from 'vitest';
import { ProgressService } from './progress.service.js';

const MEMBER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EXERCISE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RECORD_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const memberUser = {
  id: MEMBER_ID,
  role: 'MIEMBRO',
  isActive: true,
} as never;

/** Calendario fijo del gimnasio: hoy es 2026-11-10. */
function setup() {
  const repo = {
    upsert: vi.fn().mockResolvedValue({ id: 'r1' }),
    history: vi
      .fn()
      .mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 10 }),
    evolution: vi.fn().mockResolvedValue({ metric: 'weightKg', points: [] }),
  };
  const clock = { today: () => '2026-11-10' };
  const service = new ProgressService(repo as never, clock as never);
  return { service, repo };
}

const validInput = {
  recordDate: '2026-11-09',
  weightKg: 78.4,
  marks: [{ exerciseId: EXERCISE_ID, weightKg: 62.5, reps: 10 }],
} as never;

describe('ProgressService (H24)', () => {
  it('deriva el miembro de la sesión, nunca del body', async () => {
    const { service, repo } = setup();
    await service.create(memberUser, validInput);
    expect(repo.upsert).toHaveBeenCalledWith(MEMBER_ID, validInput);
  });

  it('rechaza un día posterior al calendario del gimnasio', async () => {
    const { service } = setup();
    await expect(
      service.create(memberUser, { ...validInput, recordDate: '2026-11-11' }),
    ).rejects.toMatchObject({ kind: 'INVALID' });
  });

  it('rechaza el mismo ejercicio marcado dos veces', async () => {
    const { service } = setup();
    const mark = { exerciseId: EXERCISE_ID, weightKg: 10, reps: 5 };
    await expect(
      service.create(memberUser, { ...validInput, marks: [mark, mark] }),
    ).rejects.toMatchObject({ kind: 'INVALID' });
  });

  it('rechaza marks:null en vez de convertirlo en un borrado implícito', async () => {
    const { service, repo } = setup();
    await expect(
      service.create(memberUser, { ...validInput, marks: null } as never),
    ).rejects.toMatchObject({
      kind: 'INVALID',
      message: 'marks debe ser un arreglo. field=marks',
    });
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('limita la cantidad de marcas por registro', async () => {
    const { service } = setup();
    const marks = Array.from({ length: 31 }, (_unused, index) => ({
      exerciseId: `${index}`.padStart(36, '0'),
      weightKg: 10,
      reps: 5,
    }));
    await expect(
      service.create(memberUser, { ...validInput, marks }),
    ).rejects.toMatchObject({ kind: 'INVALID' });
  });

  it('sólo un miembro activo usa su progreso personal', async () => {
    const { service, repo } = setup();
    await expect(
      service.history(
        { id: MEMBER_ID, role: 'ENTRENADOR', isActive: true } as never,
        { page: 1, pageSize: 10 } as never,
      ),
    ).rejects.toMatchObject({ kind: 'FORBIDDEN' });
    await expect(
      service.history(
        { id: MEMBER_ID, role: 'MIEMBRO', isActive: false } as never,
        { page: 1, pageSize: 10 } as never,
      ),
    ).rejects.toMatchObject({ kind: 'FORBIDDEN' });
    expect(repo.history).not.toHaveBeenCalled();
  });

  it('edita el registro con el id de ruta', async () => {
    const { service, repo } = setup();
    await service.update(memberUser, RECORD_ID, validInput);
    expect(repo.upsert).toHaveBeenCalledWith(MEMBER_ID, validInput, RECORD_ID);
  });

  it('rechaza un identificador de ruta mal formado', async () => {
    const { service } = setup();
    await expect(
      service.update(memberUser, 'no-uuid', validInput),
    ).rejects.toMatchObject({ kind: 'INVALID' });
  });
});

describe('ProgressService (H25)', () => {
  it('exige exerciseId en la métrica de marcas', async () => {
    const { service } = setup();
    await expect(
      service.evolution(memberUser, { metric: 'exerciseWeightKg' } as never),
    ).rejects.toMatchObject({ kind: 'INVALID' });
  });

  it('valida el rango civil antes de consultar', async () => {
    const { service, repo } = setup();
    await expect(
      service.evolution(memberUser, {
        metric: 'weightKg',
        from: '2026-11-10',
        to: '2026-01-01',
      } as never),
    ).rejects.toMatchObject({ kind: 'INVALID' });
    await expect(
      service.evolution(memberUser, {
        metric: 'weightKg',
        from: '2025-01-01',
        to: '2026-11-10',
      } as never),
    ).rejects.toMatchObject({ kind: 'INVALID' });
    expect(repo.evolution).not.toHaveBeenCalled();
  });

  it('propaga el rango y el ejercicio al repositorio', async () => {
    const { service, repo } = setup();
    await service.evolution(memberUser, {
      metric: 'exerciseWeightKg',
      exerciseId: EXERCISE_ID,
      from: '2026-01-01',
      to: '2026-11-10',
    } as never);
    expect(repo.evolution).toHaveBeenCalledWith(
      MEMBER_ID,
      'exerciseWeightKg',
      EXERCISE_ID,
      '2026-01-01',
      '2026-11-10',
    );
  });

  it('acota al máximo anual las consultas que sólo indican from o to', async () => {
    const { service, repo } = setup();
    await service.evolution(memberUser, {
      metric: 'weightKg',
      from: '2025-01-01',
    } as never);
    expect(repo.evolution).toHaveBeenLastCalledWith(
      MEMBER_ID,
      'weightKg',
      undefined,
      '2025-01-01',
      '2026-01-01',
    );
    await service.evolution(memberUser, {
      metric: 'weightKg',
      to: '2026-11-10',
    } as never);
    expect(repo.evolution).toHaveBeenLastCalledWith(
      MEMBER_ID,
      'weightKg',
      undefined,
      '2025-11-10',
      '2026-11-10',
    );
  });

  it('sin filtros consulta la serie completa', async () => {
    const { service, repo } = setup();
    await service.evolution(memberUser, { metric: 'weightKg' } as never);
    expect(repo.evolution).toHaveBeenCalledWith(
      MEMBER_ID,
      'weightKg',
      undefined,
      null,
      null,
    );
  });
});
