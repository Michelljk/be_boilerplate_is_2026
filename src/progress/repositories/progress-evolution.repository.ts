
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import type { Prisma } from '@PrismaClient';

import type { ProgressMetric } from '../dto/evolution-query.dto.js';
import type { EvolutionView } from '../dto/evolution-response.dto.js';
import { calculateEvolution } from '../domain/evolution-summary.js';

const MAX_SERIES_POINTS = 366;

type BodyMetric =
  | 'weightKg'
  | 'waistCm'
  | 'chestCm'
  | 'armCm';

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/**
 * H25 — Consultas de evolución física del miembro.
 */
@Injectable()
export class ProgressEvolutionRepository {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async evolution(
    memberId: string,
    metric: ProgressMetric,
    exerciseId: string | undefined,
    from: string | null,
    to: string | null,
  ): Promise<EvolutionView> {
    const range = this.dateRange(from, to);

    if (metric === 'exerciseWeightKg') {
      if (!exerciseId) {
        throw new Error(
          'exerciseId es obligatorio para esta métrica.',
        );
      }

      const points = await this.exerciseSeries(
        memberId,
        exerciseId,
        range,
      );

      return calculateEvolution(metric, points);
    }

    const points = await this.bodySeries(
      memberId,
      metric,
      range,
    );

    return calculateEvolution(metric, points);
  }

  /**
   * Convierte las fechas a un filtro Prisma.
   */
  private dateRange(
    from: string | null,
    to: string | null,
  ): Prisma.DateTimeFilter | undefined {
    if (!from && !to) {
      return undefined;
    }

    return {
      ...(from ? { gte: toUtcDate(from) } : {}),
      ...(to ? { lte: toUtcDate(to) } : {}),
    };
  }

  /**
   * Serie temporal de peso y medidas corporales.
   * Omite mediciones nulas.
   */
  private async bodySeries(
    memberId: string,
    metric: BodyMetric,
    range: Prisma.DateTimeFilter | undefined,
  ) {
    const records = await this.prisma.progressRecord.findMany({
      where: {
        memberId,
        recordDate: range,
      },
      select: {
        recordDate: true,
        weightKg: true,
        waistCm: true,
        chestCm: true,
        armCm: true,
      },
      orderBy: {
        recordDate: 'desc',
      },
      take: MAX_SERIES_POINTS,
    });

    return records
      .reverse()
      .flatMap((record) => {
        const value = record[metric];

        if (value === null) {
          return [];
        }

        return [{
          date: toDateString(record.recordDate),
          value: Number(value),
          reps: null,
        }];
      });
  }

  /**
   * Serie temporal de marcas de un ejercicio.
   * Conserva las repeticiones de cada medición.
   */
  private async exerciseSeries(
    memberId: string,
    exerciseId: string,
    range: Prisma.DateTimeFilter | undefined,
  ) {
    const records = await this.prisma.progressRecord.findMany({
      where: {
        memberId,
        recordDate: range,
        marks: {
          some: {
            exerciseId,
          },
        },
      },
      select: {
        recordDate: true,
        marks: {
          where: {
            exerciseId,
          },
          select: {
            weightKg: true,
            reps: true,
          },
        },
      },
      orderBy: {
        recordDate: 'asc',
      },
      take: MAX_SERIES_POINTS,
    });

    return records.flatMap((record) =>
      record.marks.map((mark) => ({
        date: toDateString(record.recordDate),
        value: Number(mark.weightKg),
        reps: mark.reps,
      })),
    );
  }
}
