
import { Injectable } from '@nestjs/common';
import { Prisma } from '@PrismaClient';
import { DomainError } from '@Common/errors';
import { serializable } from '@Common/repositories';
import { PrismaService } from '@Prisma/services';

import type { ProgressRecordInputDto } from '../dto/progress-record-input.dto.js';

export interface ProgressMarkView {
  exerciseId: string;
  weightKg: number;
  reps: number;
}

export interface ProgressRecordView {
  id: string;
  recordDate: string;
  weightKg: number;
  waistCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  isBaseline: boolean;
  marks: ProgressMarkView[];
}

export interface ProgressHistoryPage {
  rows: ProgressRecordView[];
  total: number;
  page: number;
  pageSize: number;
}

const recordSelect = {
  id: true,
  recordDate: true,
  weightKg: true,
  waistCm: true,
  chestCm: true,
  armCm: true,
  marks: {
    select: {
      exerciseId: true,
      weightKg: true,
      reps: true,
    },
    orderBy: {
      exerciseId: 'asc' as const,
    },
  },
} satisfies Prisma.ProgressRecordSelect;

type RecordRow = Prisma.ProgressRecordGetPayload<{
  select: typeof recordSelect;
}>;

function mapRecord(
  row: RecordRow,
  baselineDate: Date | null,
): ProgressRecordView {
  return {
    id: row.id,
    recordDate: row.recordDate.toISOString().slice(0, 10),
    weightKg: Number(row.weightKg),
    waistCm:
      row.waistCm === null ? null : Number(row.waistCm),
    chestCm:
      row.chestCm === null ? null : Number(row.chestCm),
    armCm:
      row.armCm === null ? null : Number(row.armCm),
    isBaseline:
      baselineDate !== null &&
      row.recordDate.getTime() === baselineDate.getTime(),
    marks: row.marks.map((mark) => ({
      exerciseId: mark.exerciseId,
      weightKg: Number(mark.weightKg),
      reps: mark.reps,
    })),
  };
}

@Injectable()
export class ProgressRecordRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * H24: registra o actualiza el progreso del miembro.
   */
  async upsert(
    memberId: string,
    input: ProgressRecordInputDto,
    recordId?: string,
  ): Promise<ProgressRecordView> {
    try {
      return await serializable(this.prisma, async (tx) => {
        const measurements = {
          recordDate: new Date(
            `${input.recordDate}T00:00:00.000Z`,
          ),
          weightKg: new Prisma.Decimal(input.weightKg),
          waistCm: this.toDecimal(input.waistCm),
          chestCm: this.toDecimal(input.chestCm),
          armCm: this.toDecimal(input.armCm),
        };

        let id = recordId;

        if (recordId) {
          const updated = await tx.progressRecord.updateMany({
            where: {
              id: recordId,
              memberId,
            },
            data: measurements,
          });

          if (updated.count !== 1) {
            throw new DomainError(
              'NOT_FOUND',
              'Recurso no encontrado.',
            );
          }
        } else {
          const created = await tx.progressRecord.create({
            data: {
              memberId,
              ...measurements,
            },
            select: {
              id: true,
            },
          });

          id = created.id;
        }

        if (input.marks !== undefined) {
          await this.replaceMarks(
            tx,
            id as string,
            input.marks,
          );
        }

        const row = await tx.progressRecord.findUnique({
          where: { id: id as string },
          select: recordSelect,
        });

        if (!row) {
          throw new DomainError(
            'NOT_FOUND',
            'Recurso no encontrado.',
          );
        }

        const baseline = await tx.progressRecord.findFirst({
          where: { memberId },
          orderBy: [
            { recordDate: 'asc' },
            { id: 'asc' },
          ],
          select: { recordDate: true },
        });

        return mapRecord(
          row,
          baseline?.recordDate ?? null,
        );
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DomainError(
          'CONFLICT',
          'Ya registraste progreso ese día.',
        );
      }
      throw error;
    }
  }

  /**
   * H24: sustituye las marcas del registro.
   */
  private async replaceMarks(
    tx: Prisma.TransactionClient,
    recordId: string,
    marks: NonNullable<ProgressRecordInputDto['marks']>,
  ): Promise<void> {
    const exerciseIds = [
      ...new Set(marks.map((mark) => mark.exerciseId)),
    ];

    if (exerciseIds.length > 0) {
      const active = await tx.exercise.findMany({
        where: {
          id: { in: exerciseIds },
          isActive: true,
        },
        select: { id: true },
      });

      if (active.length !== exerciseIds.length) {
        throw new DomainError(
          'INVALID',
          'Ejercicio no válido o inactivo. field=marks.exerciseId',
        );
      }
    }

    await tx.exerciseMark.deleteMany({
      where: { progressRecordId: recordId },
    });

    if (marks.length > 0) {
      await tx.exerciseMark.createMany({
        data: marks.map((mark) => ({
          progressRecordId: recordId,
          exerciseId: mark.exerciseId,
          weightKg: new Prisma.Decimal(mark.weightKg),
          reps: mark.reps,
        })),
      });
    }
  }

  /**
   * H24: historial paginado del miembro.
   */
  async history(
    memberId: string,
    page: number,
    pageSize: number,
  ): Promise<ProgressHistoryPage> {
    const [rows, total, baseline] = await Promise.all([
      this.prisma.progressRecord.findMany({
        where: { memberId },
        select: recordSelect,
        orderBy: [
          { recordDate: 'desc' },
          { id: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.progressRecord.count({
        where: { memberId },
      }),
      this.prisma.progressRecord.findFirst({
        where: { memberId },
        orderBy: [
          { recordDate: 'asc' },
          { id: 'asc' },
        ],
        select: { recordDate: true },
      }),
    ]);

    return {
      rows: rows.map((row) =>
        mapRecord(row, baseline?.recordDate ?? null),
      ),
      total,
      page,
      pageSize,
    };
  }

  private toDecimal(
    value: number | null | undefined,
  ): Prisma.Decimal | null {
    return value === null || value === undefined
      ? null
      : new Prisma.Decimal(value);
  }
}
