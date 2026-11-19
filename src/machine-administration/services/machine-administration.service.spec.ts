import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainError } from '@Common/errors';
import { MachineStatus } from '@PrismaClient';
import { MachineAdministrationService } from './machine-administration.service.js';
const id = '11111111-1111-4111-8111-111111111111';
const clock = {
  now: () => new Date(),
  today: () => '2026-11-19',
  dateOf: () => '2026-11-19',
  dateOnly: (d: string) => new Date(`${d}T00:00:00Z`),
};
describe('MachineAdministrationService H27', () => {
  let repo: any;
  let service: MachineAdministrationService;
  beforeEach(() => {
    repo = {
      listMaintenanceHistory: vi.fn(),
      openMaintenance: vi.fn(),
      completeMaintenance: vi.fn(),
    };
    service = new MachineAdministrationService(repo, clock as any);
  });
  it('returns paginated history including closed periods', async () => {
    const row = {
      id,
      machineId: id,
      reason: 'Revisión equipo de gimnasio',
      startedAt: new Date('2026-01-01'),
      endedAt: new Date('2026-01-02'),
      createdById: id,
      closedById: id,
      createdAt: new Date('2026-01-01'),
    };
    repo.listMaintenanceHistory.mockResolvedValue({ data: [row], total: 3 });
    const result = await service.listMaintenanceHistory(id, {
      page: 2,
      pageSize: 1,
    });
    expect(result).toMatchObject({
      total: 3,
      page: 2,
      pageSize: 1,
      data: [row],
    });
    expect(repo.listMaintenanceHistory).toHaveBeenCalledWith({
      machineId: id,
      openOnly: undefined,
      page: 2,
      pageSize: 1,
    });
  });
  it('filters open periods when requested', async () => {
    repo.listMaintenanceHistory.mockResolvedValue({ data: [], total: 0 });
    await service.listMaintenanceHistory(id, {
      openOnly: true,
      page: 1,
      pageSize: 20,
    });
    expect(repo.listMaintenanceHistory).toHaveBeenCalledWith({
      machineId: id,
      openOnly: true,
      page: 1,
      pageSize: 20,
    });
  });
  it('passes openOnly=false so the repository returns closed and open history', async () => {
    repo.listMaintenanceHistory.mockResolvedValue({ data: [], total: 2 });
    await service.listMaintenanceHistory(id, {
      openOnly: false,
      page: 1,
      pageSize: 20,
    });
    expect(repo.listMaintenanceHistory).toHaveBeenCalledWith({
      machineId: id,
      openOnly: false,
      page: 1,
      pageSize: 20,
    });
  });
  it('preserves more than one closed maintenance period for the same machine', async () => {
    const first = {
      id,
      machineId: id,
      reason: 'Revisión equipo de gimnasio',
      startedAt: new Date('2026-01-01'),
      endedAt: new Date('2026-01-02'),
      createdById: id,
      closedById: id,
      createdAt: new Date('2026-01-01'),
    };
    const second = {
      ...first,
      id: '22222222-2222-4222-8222-222222222222',
      startedAt: new Date('2026-02-01'),
      endedAt: new Date('2026-02-02'),
    };
    repo.listMaintenanceHistory.mockResolvedValue({
      data: [second, first],
      total: 2,
    });
    const result = await service.listMaintenanceHistory(id, {
      openOnly: false,
      page: 1,
      pageSize: 20,
    });
    expect(result.data).toHaveLength(2);
    expect(result.data.map((entry) => entry.id)).toEqual([second.id, first.id]);
  });
  it('rejects malformed machine id and invalid pagination', async () => {
    await expect(
      service.listMaintenanceHistory('bad', {} as any),
    ).rejects.toBeInstanceOf(DomainError);
    await expect(
      service.listMaintenanceHistory(id, { page: 0, pageSize: 20 }),
    ).rejects.toBeInstanceOf(DomainError);
  });
  it('opens maintenance with authenticated author and closes existing period', async () => {
    repo.openMaintenance.mockResolvedValue({
      maintenance: {
        id,
        machineId: id,
        startedAt: new Date('2026-11-18T10:00:00Z'),
        reason: 'Revisión periódica general',
        createdById: id,
      },
      machineStatus: MachineStatus.EN_MANTENIMIENTO,
    });
    const opened = await service.openMaintenance(
      id,
      {
        reason: 'Revisión periódica general',
        startsAt: '2026-11-18T10:00:00Z',
      },
      id,
    );
    expect(opened.status).toBe(MachineStatus.EN_MANTENIMIENTO);
    expect(repo.openMaintenance).toHaveBeenCalledWith(
      expect.objectContaining({ createdById: id }),
    );
    repo.completeMaintenance.mockResolvedValue({
      maintenance: { id },
      endedAt: new Date('2026-11-19T10:00:00Z'),
      closedById: id,
      machineStatus: MachineStatus.DISPONIBLE,
    });
    const closed = await service.completeMaintenance(
      id,
      id,
      { endedAt: '2026-11-19T10:00:00Z' },
      id,
    );
    expect(closed.machineStatus).toBe(MachineStatus.DISPONIBLE);
    expect(repo.completeMaintenance).toHaveBeenCalledWith(
      expect.objectContaining({ maintenanceId: id, closedById: id }),
    );
  });
});
