import { describe, expect, it, vi } from 'vitest';
import { RoutineQueriesService } from './routine-queries.service.js';

const TRAINER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const MEMBER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function setup() {
  const repository = { findCurrentForTrainer: vi.fn().mockResolvedValue(null) };
  const clock = {
    today: () => '2026-11-19',
    dateOnly: (value: string) => new Date(`${value}T00:00:00.000Z`),
  };
  return {
    service: new RoutineQueriesService(repository as never, clock as never),
    repository,
  };
}

describe('RoutineQueriesService H26 current routine', () => {
  it('rechaza roles no entrenador antes de consultar repositorio', async () => {
    const { service, repository } = setup();
    await expect(
      service.findCurrentForTrainer(
        { id: TRAINER_ID, role: 'MIEMBRO' } as never,
        MEMBER_ID,
      ),
    ).rejects.toMatchObject({ kind: 'FORBIDDEN' });
    expect(repository.findCurrentForTrainer).not.toHaveBeenCalled();
  });

  it('rechaza memberId inválido y no consulta repositorio', async () => {
    const { service, repository } = setup();
    await expect(
      service.findCurrentForTrainer(
        { id: TRAINER_ID, role: 'ENTRENADOR' } as never,
        'bad-id',
      ),
    ).rejects.toMatchObject({ kind: 'INVALID' });
    expect(repository.findCurrentForTrainer).not.toHaveBeenCalled();
  });

  it('usa identidad autenticada, miembro de ruta y devuelve null si no hay rutina vigente', async () => {
    const { service, repository } = setup();
    await expect(
      service.findCurrentForTrainer(
        { id: TRAINER_ID, role: 'ENTRENADOR' } as never,
        MEMBER_ID,
      ),
    ).resolves.toBeNull();
    expect(repository.findCurrentForTrainer).toHaveBeenCalledWith(
      TRAINER_ID,
      MEMBER_ID,
      new Date('2026-11-19T00:00:00.000Z'),
    );
  });

  it('preserva el 404 genérico para miembro no asignado', async () => {
    const { service, repository } = setup();
    repository.findCurrentForTrainer.mockRejectedValue(
      Object.assign(new Error('Recurso no encontrado.'), { kind: 'NOT_FOUND' }),
    );
    await expect(
      service.findCurrentForTrainer(
        { id: TRAINER_ID, role: 'ENTRENADOR' } as never,
        MEMBER_ID,
      ),
    ).rejects.toMatchObject({ kind: 'NOT_FOUND' });
  });
});
