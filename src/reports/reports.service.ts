import { Injectable } from '@nestjs/common';
import { ReportsRepository } from './repositories/reports.repository.js';

@Injectable()
export class ReportsService {
  constructor(private readonly repository: ReportsRepository) {}

  occupancy(from: string, to: string) {
    return this.repository.occupancy(from, to);
  }

  income(from: string, to: string) {
    return this.repository.income(from, to);
  }

  retention(from: string, to: string) {
    return this.repository.retention(from, to);
  }

  trainerPerformance(
    from: string,
    to: string,
    sortBy: 'rating' | 'sessions',
    order: 'asc' | 'desc',
  ) {
    return this.repository.trainerPerformance(from, to, sortBy, order);
  }
}
