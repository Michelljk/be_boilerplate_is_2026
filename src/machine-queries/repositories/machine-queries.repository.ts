import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/services/prisma.service.js';
import { Prisma, type MachineStatus } from '../../generated/prisma/client.js';

export interface MachineListFilters {
  status?: MachineStatus;
  location?: string;
  page: number;
  pageSize: number;
}

export type MachineListRecord = {
  id: string;
  name: string;
  type: string;
  location: string;
  status: MachineStatus;
  updatedAt: Date;
};

export interface MachineListResult {
  data: MachineListRecord[];
  total: number;
}

const machineListSelect = {
  id: true,
  name: true,
  type: true,
  location: true,
  status: true,
  updatedAt: true,
} as const;

@Injectable()
export class MachineQueriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: MachineListFilters): Promise<MachineListResult> {
    const where: Prisma.MachineWhereInput = {};
    if (filters.status !== undefined) where.status = filters.status;
    if (filters.location !== undefined) where.location = filters.location;

    const [data, total] = await this.prisma.$transaction(
      async (tx) => {
        const [machines, count] = await Promise.all([
          tx.machine.findMany({
            where,
            select: machineListSelect,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            skip: (filters.page - 1) * filters.pageSize,
            take: filters.pageSize,
          }),
          tx.machine.count({ where }),
        ]);
        return [machines, count] as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );

    return { data, total };
  }
}
