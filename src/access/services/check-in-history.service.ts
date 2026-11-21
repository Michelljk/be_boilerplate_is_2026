import { Injectable } from '@nestjs/common';
import { GymClock } from '@Common/time';
import {
  resolveHistoryRange,
  normalizeMemberNumber,
} from '../domain/check-in-history.policy.js';
import type { CheckInHistoryQueryDto } from '../dto/access-request.dto.js';
import { CheckInHistoryRepository } from '../repositories/check-in-history.repository.js';

@Injectable()
export class CheckInHistoryService {
  constructor(
    private readonly historyRepository: CheckInHistoryRepository,
    private readonly clock: GymClock,
  ) {}

  async history(query: CheckInHistoryQueryDto) {
    const { from, to } = resolveHistoryRange(query, this.clock.today());
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const snapshot = await this.historyRepository.paginate({
      from: this.clock.dateOnly(from),
      to: this.clock.dateOnly(to),
      memberNumber: normalizeMemberNumber(query.memberNumber),
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { ...snapshot, page, pageSize };
  }
}
