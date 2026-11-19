import { describe, expect, it, vi } from 'vitest';
import { MachineStatus } from '../../generated/prisma/client.js';
import { MachineQueriesService } from './machine-queries.service.js';

describe('MachineQueriesService H28', () => {
  it('propaga conjuntamente estado, ubicación y paginación al repositorio', async () => {
    const repository = {
      list: vi.fn().mockResolvedValue({ data: [], total: 7 }),
    };
    const service = new MachineQueriesService(repository as never);

    const result = await service.list({
      status: MachineStatus.DISPONIBLE,
      location: 'Sala de pesas',
      page: 2,
      pageSize: 5,
    });

    expect(repository.list).toHaveBeenCalledWith({
      status: MachineStatus.DISPONIBLE,
      location: 'Sala de pesas',
      page: 2,
      pageSize: 5,
    });
    expect(result).toMatchObject({ data: [], total: 7, page: 2, pageSize: 5 });
  });

  it('usa los valores por defecto cuando no se envían filtros ni paginación', async () => {
    const repository = {
      list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    };
    const service = new MachineQueriesService(repository as never);

    await service.list({} as never);

    expect(repository.list).toHaveBeenCalledWith({
      status: undefined,
      location: undefined,
      page: 1,
      pageSize: 20,
    });
  });
});
