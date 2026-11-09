import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { serializable } from '@Common/repositories';
import { DomainError } from '@Common/errors';
import {
  Prisma,
  type Machine,
  type MachineMaintenance,
  MachineStatus,
} from '@PrismaClient';

export interface ListMachinesQuery {
  status?: MachineStatus;
  location?: string;
  page: number;
  pageSize: number;
}

export interface OpenMaintenanceData {
  machineId: string;
  reason: string;
  startedAt: Date;
  createdById: string;
}

export interface OpenMaintenanceResult {
  maintenance: MachineMaintenance;
  machineStatus: MachineStatus;
}

export interface CompleteMaintenanceData {
  machineId: string;
  maintenanceId: string;
  endedAt: Date;
  closedById: string;
}

export interface CompleteMaintenanceResult {
  maintenance: MachineMaintenance;
  machineStatus: MachineStatus;
  endedAt: Date;
  closedById: string;
}

export interface ChangeMachineStatusData {
  machineId: string;
  status: Extract<MachineStatus, 'DISPONIBLE' | 'FUERA_SERVICIO'>;
  reason: string;
  changedById: string;
}

export interface ChangeMachineStatusResult {
  machineId: string;
  status: Extract<MachineStatus, 'DISPONIBLE' | 'FUERA_SERVICIO'>;
  updatedAt: Date;
}

export interface MachineListSnapshot {
  data: Machine[];
  total: number;
}

type LockedRow = { id: string };

@Injectable()
export class MachineAdministrationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listMachines(query: ListMachinesQuery): Promise<MachineListSnapshot> {
    const where: Prisma.MachineWhereInput = {};
    if (query.status !== undefined) where.status = query.status;
    if (query.location !== undefined && query.location.length > 0) {
      where.location = { contains: query.location, mode: 'insensitive' };
    }

    return this.prisma.$transaction(
      async (tx) => {
        const [data, total] = await Promise.all([
          tx.machine.findMany({
            where,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          }),
          tx.machine.count({ where }),
        ]);
        return { data, total };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  openMaintenance(data: OpenMaintenanceData): Promise<OpenMaintenanceResult> {
    return serializable(this.prisma, async (tx) => {
      await this.lockMachine(tx, data.machineId);
      const machine = await tx.machine.findUnique({
        where: { id: data.machineId },
      });
      if (!machine)
        throw new DomainError('NOT_FOUND', 'Máquina no encontrada.');

      const openMaintenance = await tx.machineMaintenance.findFirst({
        where: { machineId: data.machineId, endedAt: null },
      });
      if (
        openMaintenance ||
        machine.status === MachineStatus.EN_MANTENIMIENTO
      ) {
        throw new DomainError(
          'CONFLICT',
          'La máquina ya tiene un mantenimiento abierto.',
        );
      }

      const maintenance = await tx.machineMaintenance.create({
        data: {
          machineId: data.machineId,
          reason: data.reason,
          startedAt: data.startedAt,
          createdById: data.createdById,
        },
      });
      await tx.machine.update({
        where: { id: data.machineId },
        data: { status: MachineStatus.EN_MANTENIMIENTO },
      });
      await tx.machineStatusChange.create({
        data: {
          machineId: data.machineId,
          fromStatus: machine.status,
          toStatus: MachineStatus.EN_MANTENIMIENTO,
          reason: data.reason,
          changedById: data.createdById,
        },
      });
      return { maintenance, machineStatus: MachineStatus.EN_MANTENIMIENTO };
    });
  }

  completeMaintenance(
    data: CompleteMaintenanceData,
  ): Promise<CompleteMaintenanceResult> {
    return serializable(this.prisma, async (tx) => {
      await this.lockMachine(tx, data.machineId);
      const machine = await tx.machine.findUnique({
        where: { id: data.machineId },
      });
      if (!machine)
        throw new DomainError('NOT_FOUND', 'Máquina no encontrada.');

      const maintenance = await tx.machineMaintenance.findFirst({
        where: { id: data.maintenanceId, machineId: data.machineId },
      });
      if (!maintenance) {
        throw new DomainError('NOT_FOUND', 'Mantenimiento no encontrado.');
      }
      if (maintenance.endedAt !== null) {
        throw new DomainError('CONFLICT', 'El mantenimiento ya está cerrado.');
      }
      if (data.endedAt.getTime() < maintenance.startedAt.getTime()) {
        throw new DomainError(
          'INVALID',
          'La fecha de fin no puede ser anterior a la fecha de inicio.',
        );
      }
      if (machine.status !== MachineStatus.EN_MANTENIMIENTO) {
        throw new DomainError(
          'CONFLICT',
          'La máquina no está en mantenimiento; no se puede cerrar el período.',
        );
      }

      const updatedMaintenance = await tx.machineMaintenance.update({
        where: { id: data.maintenanceId },
        data: { endedAt: data.endedAt, closedById: data.closedById },
      });
      await tx.machine.update({
        where: { id: data.machineId },
        data: { status: MachineStatus.DISPONIBLE },
      });
      await tx.machineStatusChange.create({
        data: {
          machineId: data.machineId,
          fromStatus: machine.status,
          toStatus: MachineStatus.DISPONIBLE,
          reason: maintenance.reason,
          changedById: data.closedById,
        },
      });
      return {
        maintenance: updatedMaintenance,
        machineStatus: MachineStatus.DISPONIBLE,
        endedAt: data.endedAt,
        closedById: data.closedById,
      };
    });
  }

  changeMachineStatus(
    data: ChangeMachineStatusData,
  ): Promise<ChangeMachineStatusResult> {
    return serializable(this.prisma, async (tx) => {
      await this.lockMachine(tx, data.machineId);
      const machine = await tx.machine.findUnique({
        where: { id: data.machineId },
      });
      if (!machine)
        throw new DomainError('NOT_FOUND', 'Máquina no encontrada.');

      const openMaintenance = await tx.machineMaintenance.findFirst({
        where: { machineId: data.machineId, endedAt: null },
        select: { id: true },
      });
      if (openMaintenance) {
        throw new DomainError(
          'CONFLICT',
          'La máquina tiene un mantenimiento abierto; debe cerrarse mediante complete.',
        );
      }
      if (machine.status === data.status) {
        throw new DomainError('CONFLICT', 'La máquina ya tiene ese estado.');
      }
      if (machine.status === MachineStatus.EN_MANTENIMIENTO) {
        throw new DomainError(
          'CONFLICT',
          'La máquina está en mantenimiento; debe cerrarse mediante complete.',
        );
      }

      const updatedMachine = await tx.machine.update({
        where: { id: data.machineId },
        data: { status: data.status },
      });
      await tx.machineStatusChange.create({
        data: {
          machineId: data.machineId,
          fromStatus: machine.status,
          toStatus: data.status,
          reason: data.reason,
          changedById: data.changedById,
        },
      });
      return {
        machineId: updatedMachine.id,
        status: data.status,
        updatedAt: updatedMachine.updatedAt,
      };
    });
  }

  private async lockMachine(
    tx: Prisma.TransactionClient,
    machineId: string,
  ): Promise<void> {
    await tx.$queryRaw<LockedRow[]>`
      SELECT id FROM machines WHERE id = ${machineId}::uuid FOR UPDATE
    `;
  }
}
