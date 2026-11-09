import { Injectable } from '@nestjs/common';
import { DomainError } from '@Common/errors';
import { GymClock } from '@Common/time';
import { MachineStatus, type Machine } from '@PrismaClient';
import {
  MachineAdministrationRepository,
  type ListMachinesQuery,
} from '../repositories/index.js';
import type {
  ChangeMachineStatusDto,
  CompleteMaintenanceDto,
  ListMachinesQueryDto,
  OpenMaintenanceDto,
  ChangeMachineStatusResponseDto,
  CompleteMaintenanceResponseDto,
  MachineListResponseDto,
  MachineSummaryDto,
  OpenMaintenanceResponseDto,
} from '../dto/index.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/;

@Injectable()
export class MachineAdministrationService {
  constructor(
    private readonly repository: MachineAdministrationRepository,
    private readonly clock: GymClock,
  ) {}

  async list(query: ListMachinesQueryDto): Promise<MachineListResponseDto> {
    const normalized = this.validateListQuery(query);
    const result = await this.repository.listMachines(normalized);
    return {
      data: result.data.map((machine) => this.toMachineSummary(machine)),
      total: result.total,
      page: normalized.page,
      pageSize: normalized.pageSize,
    };
  }

  async openMaintenance(
    machineId: string,
    dto: OpenMaintenanceDto,
    createdById: string,
  ): Promise<OpenMaintenanceResponseDto> {
    this.validateUuid(machineId, 'El id de la máquina no es válido.');
    this.validateUuid(createdById, 'La identidad autenticada no es válida.');
    const reason = this.validateReason(dto.reason);
    const startedAt = this.parseInstant(
      dto.startsAt,
      'La fecha de inicio no es válida.',
    );
    const result = await this.repository.openMaintenance({
      machineId,
      reason,
      startedAt,
      createdById,
    });
    return {
      id: result.maintenance.id,
      machineId: result.maintenance.machineId,
      startedAt: result.maintenance.startedAt,
      endedAt: null,
      reason: result.maintenance.reason,
      createdById: result.maintenance.createdById,
      status: MachineStatus.EN_MANTENIMIENTO,
    };
  }

  async completeMaintenance(
    machineId: string,
    maintenanceId: string,
    dto: CompleteMaintenanceDto,
    closedById: string,
  ): Promise<CompleteMaintenanceResponseDto> {
    this.validateUuid(machineId, 'El id de la máquina no es válido.');
    this.validateUuid(maintenanceId, 'El id del mantenimiento no es válido.');
    this.validateUuid(closedById, 'La identidad autenticada no es válida.');
    const endedAt = this.parseInstant(
      dto.endedAt,
      'La fecha de fin no es válida.',
    );
    const result = await this.repository.completeMaintenance({
      machineId,
      maintenanceId,
      endedAt,
      closedById,
    });
    return {
      id: result.maintenance.id,
      endedAt: result.endedAt,
      closedById: result.closedById,
      machineStatus: MachineStatus.DISPONIBLE,
    };
  }

  async changeMachineStatus(
    machineId: string,
    dto: ChangeMachineStatusDto,
    changedById: string,
  ): Promise<ChangeMachineStatusResponseDto> {
    this.validateUuid(machineId, 'El id de la máquina no es válido.');
    this.validateUuid(changedById, 'La identidad autenticada no es válida.');
    if (
      dto.status !== MachineStatus.DISPONIBLE &&
      dto.status !== MachineStatus.FUERA_SERVICIO
    ) {
      throw new DomainError(
        'INVALID',
        'El estado manual solicitado no es válido.',
      );
    }
    const status = dto.status;
    const reason = this.validateReason(dto.reason);
    const result = await this.repository.changeMachineStatus({
      machineId,
      status,
      reason,
      changedById,
    });
    return {
      machineId: result.machineId,
      status: result.status,
      updatedAt: result.updatedAt,
    };
  }

  private validateListQuery(query: ListMachinesQueryDto): ListMachinesQuery {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    if (!Number.isInteger(page) || page < 1) {
      throw new DomainError(
        'INVALID',
        'La página debe ser un entero mayor o igual a 1.',
      );
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
      throw new DomainError(
        'INVALID',
        'El tamaño de página debe estar entre 1 y 50.',
      );
    }
    if (
      query.status !== undefined &&
      !Object.values(MachineStatus).includes(query.status)
    ) {
      throw new DomainError('INVALID', 'El estado de máquina no es válido.');
    }
    if (query.location !== undefined && typeof query.location !== 'string') {
      throw new DomainError('INVALID', 'La ubicación no es válida.');
    }
    return {
      status: query.status,
      location: query.location?.trim(),
      page,
      pageSize,
    };
  }

  private validateUuid(value: string, message: string): void {
    if (!UUID_PATTERN.test(value)) throw new DomainError('INVALID', message);
  }

  private validateReason(value: string): string {
    if (typeof value !== 'string') {
      throw new DomainError('INVALID', 'El motivo debe ser texto.');
    }
    const reason = value.trim();
    if (reason.length < 10 || reason.length > 250) {
      throw new DomainError(
        'INVALID',
        'El motivo debe tener entre 10 y 250 caracteres.',
      );
    }
    return reason;
  }

  private parseInstant(value: string, message: string): Date {
    if (typeof value !== 'string' || !ISO_INSTANT_PATTERN.test(value)) {
      throw new DomainError('INVALID', message);
    }
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()))
      throw new DomainError('INVALID', message);
    return date;
  }

  private toMachineSummary(machine: Machine): MachineSummaryDto {
    return {
      id: machine.id,
      name: machine.name,
      type: machine.type,
      location: machine.location,
      status: machine.status,
      createdAt: machine.createdAt,
      updatedAt: machine.updatedAt,
    };
  }
}
