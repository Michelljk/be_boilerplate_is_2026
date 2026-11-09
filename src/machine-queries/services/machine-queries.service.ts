import { Injectable } from '@nestjs/common';
import {
  MachineAvailabilityDto,
  MachineListResponseDto,
  MachineQueryDto,
} from '../dto/index.js';
import { MachineQueriesRepository } from '../repositories/index.js';

@Injectable()
export class MachineQueriesService {
  constructor(
    private readonly machineQueriesRepository: MachineQueriesRepository,
  ) {}

  async list(query: MachineQueryDto): Promise<MachineListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const result = await this.machineQueriesRepository.list({
      status: query.status,
      location: query.location,
      page,
      pageSize,
    });

    return {
      data: result.data.map((machine) =>
        MachineAvailabilityDto.fromEntity(machine),
      ),
      total: result.total,
      page,
      pageSize,
    };
  }
}
