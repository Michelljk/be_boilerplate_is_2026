import { describe, expect, it, vi } from 'vitest';
import { TrainerProgressService } from './trainer-progress.service.js';

const TRAINER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const MEMBER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const trainerUser = {
  id: TRAINER_ID,
  role: 'ENTRENADOR',
  isActive: true,
} as never;

function setup() {
  const repo = {
    members: vi
      .fn()
      .mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 10 }),
    memberProgress: vi.fn().mockResolvedValue({
      memberId: MEMBER_ID,
      records: [],
      evolution: { baseline: null, latest: null, difference: null },
    }),
  };
  const service = new TrainerProgressService(repo as never);
  return { service, repo };
}

describe('TrainerProgressService (H26)', () => {
  it('rechaza a cualquier rol que no sea entrenador', async () => {
    const { service, repo } = setup();
    await expect(
      service.members(
        { id: TRAINER_ID, role: 'MIEMBRO', isActive: true } as never,
        { page: 1, pageSize: 10 } as never,
      ),
    ).rejects.toMatchObject({ kind: 'FORBIDDEN' });
    await expect(
      service.memberProgress(
        { id: TRAINER_ID, role: 'RECEPCION_ADMIN', isActive: true } as never,
        MEMBER_ID,
        {} as never,
      ),
    ).rejects.toMatchObject({ kind: 'FORBIDDEN' });
    expect(repo.members).not.toHaveBeenCalled();
    expect(repo.memberProgress).not.toHaveBeenCalled();
  });

  it('normaliza la búsqueda y pagina desde la sesión del entrenador', async () => {
    const { service, repo } = setup();
    await service.members(trainerUser, {
      search: '  María  ',
      page: 2,
      pageSize: 5,
    } as never);
    expect(repo.members).toHaveBeenCalledWith(TRAINER_ID, 'María', 2, 5);
  });

  it('sin búsqueda consulta todos los clientes asignados', async () => {
    const { service, repo } = setup();
    await service.members(trainerUser, { page: 1, pageSize: 10 } as never);
    expect(repo.members).toHaveBeenCalledWith(TRAINER_ID, '', 1, 10);
  });

  it('valida el identificador y el rango antes de leer la ficha', async () => {
    const { service, repo } = setup();
    await expect(
      service.memberProgress(trainerUser, 'no-uuid', {} as never),
    ).rejects.toMatchObject({ kind: 'INVALID' });
    await expect(
      service.memberProgress(trainerUser, MEMBER_ID, {
        from: '2026-11-10',
        to: '2026-01-01',
      } as never),
    ).rejects.toMatchObject({ kind: 'INVALID' });
    expect(repo.memberProgress).not.toHaveBeenCalled();
  });

  it('convierte el rango ausente en nulos explícitos', async () => {
    const { service, repo } = setup();
    await service.memberProgress(trainerUser, MEMBER_ID, {
      from: '2026-01-01',
    } as never);
    expect(repo.memberProgress).toHaveBeenCalledWith(TRAINER_ID, MEMBER_ID, {
      from: '2026-01-01',
      to: null,
    });
  });

  it('propaga el 404 de asignación inexistente sin transformar el error', async () => {
    const { service, repo } = setup();
    repo.memberProgress.mockRejectedValueOnce(
      Object.assign(new Error('no'), { kind: 'NOT_FOUND' }),
    );
    await expect(
      service.memberProgress(trainerUser, MEMBER_ID, {} as never),
    ).rejects.toMatchObject({ kind: 'NOT_FOUND' });
  });
});
