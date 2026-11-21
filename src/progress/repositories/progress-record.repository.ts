import { Injectable } from '@nestjs/common';
import { DomainError } from '@Common/errors';
import { serializable } from '@Common/repositories';
import { PrismaService } from '@Prisma/services';
import { Prisma } from '@PrismaClient';
import { MAX_SERIES_POINTS } from '../limits.js';
import {
  isBodyMetric,
  metricUnit,
  roundToTwoDecimals,
  type ProgressMetric,
} from '../progress-metrics.js';
import { decimalToNumber, toCivilDate } from '../progress-mapping.js';
import type {
  CivilRange,
  EvolutionPoint,
  EvolutionView,
  ProgressHistoryPage,
  ProgressRecordView,
} from '../progress-views.js';
import type { ProgressRecordInputDto } from '../dto/progress-record-input.dto.js';

export type {
  CivilRange,
  EvolutionView,
  ProgressHistoryPage,
  ProgressMarkView,
  ProgressRecordView,
} from '../progress-views.js';

/** Columna del registro que alimenta cada métrica corporal (H25). */
const BODY_COLUMN: Record<
  string,
  'weightKg' | 'waistCm' | 'chestCm' | 'armCm'
> = {
  weightKg: 'weightKg',
  waistCm: 'waistCm',
  chestCm: 'chestCm',
  armCm: 'armCm',
};

/**
 * Limita una serie ya ordenada sin perder sus extremos reales. Cuando hay más
 * de 365 puntos se conservan baseline/latest y se eligen 363 puntos interiores
 * con índices uniformemente espaciados; así el resultado es estable, no depende
 * de `createdAt` y no cambia qué datos alimentan baseline/latest.
 */
export function capEvolutionPoints(
  points: EvolutionPoint[],
  maxPoints = MAX_SERIES_POINTS,
): EvolutionPoint[] {
  if (points.length <= maxPoints) return points;
  if (maxPoints <= 0) return [];
  if (maxPoints === 1) return [points[0]];

  const interiorCount = maxPoints - 2;
  const lastIndex = points.length - 1;
  const sampled = [points[0]];
  for (let position = 1; position <= interiorCount; position += 1) {
    const index = Math.floor((position * lastIndex) / (interiorCount + 1));
    sampled.push(points[index]);
  }
  sampled.push(points[lastIndex]);
  return sampled;
}

/** Fecha civil `YYYY-MM-DD` en la forma UTC que guarda la columna `@db.Date`. */
function dayValue(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

const recordSelect = {
  id: true,
  recordDate: true,
  weightKg: true,
  waistCm: true,
  chestCm: true,
  armCm: true,
  marks: {
    select: { exerciseId: true, weightKg: true, reps: true },
    orderBy: { exerciseId: 'asc' as const },
  },
} satisfies Prisma.ProgressRecordSelect;

type RecordRow = Prisma.ProgressRecordGetPayload<{
  select: typeof recordSelect;
}>;

/** Un registro con sus marcas, ya convertido a las vistas del dominio. */
function toRecordView(
  row: RecordRow,
  baselineDate: Date | null,
): ProgressRecordView {
  return {
    id: row.id,
    recordDate: toCivilDate(row.recordDate),
    weightKg: decimalToNumber(row.weightKg) ?? 0,
    waistCm: decimalToNumber(row.waistCm),
    chestCm: decimalToNumber(row.chestCm),
    armCm: decimalToNumber(row.armCm),
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

/** Acceso a `progress_records` y `exercise_marks` (H24, H25 y H26). */
@Injectable()
export class ProgressRecordRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Alta o edición del registro de un día (H24).
   *
   * Registro y marcas se escriben en la misma transacción serializable; el
   * duplicado `memberId + recordDate` responde el 409 del PDF y editar un
   * registro ajeno responde 404 sin revelar si existe.
   */
  async upsert(
    memberId: string,
    input: ProgressRecordInputDto,
    recordId?: string,
  ): Promise<ProgressRecordView> {
    try {
      return await serializable(this.prisma, (tx) =>
        this.upsertIn(tx, memberId, input, recordId),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DomainError('CONFLICT', 'Ya registraste progreso ese día.');
      }
      throw error;
    }
  }

  private async upsertIn(
    tx: Prisma.TransactionClient,
    memberId: string,
    input: ProgressRecordInputDto,
    recordId?: string,
  ): Promise<ProgressRecordView> {
    const measurements = {
      recordDate: dayValue(input.recordDate),
      weightKg: new Prisma.Decimal(input.weightKg),
      waistCm: this.toDecimal(input.waistCm),
      chestCm: this.toDecimal(input.chestCm),
      armCm: this.toDecimal(input.armCm),
    };

    let targetId = recordId;
    if (recordId) {
      const touched = await tx.progressRecord.updateMany({
        where: { id: recordId, memberId },
        data: measurements,
      });
      if (touched.count !== 1) {
        throw new DomainError('NOT_FOUND', 'Recurso no encontrado.');
      }
    } else {
      const created = await tx.progressRecord.create({
        data: { memberId, ...measurements },
        select: { id: true },
      });
      targetId = created.id;
    }

    if (input.marks !== undefined) {
      await this.replaceMarks(tx, targetId as string, input.marks);
    }
    return this.readOne(tx, targetId as string, memberId);
  }

  /** Reemplaza el conjunto de marcas y exige ejercicios activos del catálogo. */
  private async replaceMarks(
    tx: Prisma.TransactionClient,
    recordId: string,
    marks: ProgressRecordInputDto['marks'],
  ): Promise<void> {
    const wanted = marks ?? [];
    const exerciseIds = [...new Set(wanted.map((mark) => mark.exerciseId))];
    if (exerciseIds.length > 0) {
      const active = await tx.exercise.findMany({
        where: { id: { in: exerciseIds }, isActive: true },
        select: { id: true },
      });
      if (active.length !== exerciseIds.length) {
        throw new DomainError(
          'INVALID',
          'Ejercicio no válido o inactivo. field=marks.exerciseId',
        );
      }
    }

    await tx.exerciseMark.deleteMany({ where: { progressRecordId: recordId } });
    if (wanted.length === 0) {
      return;
    }
    await tx.exerciseMark.createMany({
      data: wanted.map((mark) => ({
        progressRecordId: recordId,
        exerciseId: mark.exerciseId,
        weightKg: new Prisma.Decimal(mark.weightKg),
        reps: mark.reps,
      })),
    });
  }

  /** Historial paginado del miembro con las marcas de cada día. */
  async history(
    memberId: string,
    page: number,
    pageSize: number,
    filter: CivilRange = { from: null, to: null },
  ): Promise<ProgressHistoryPage> {
    const where = { memberId, recordDate: this.range(filter) };
    const [rows, total, baseline] = await Promise.all([
      this.prisma.progressRecord.findMany({
        where,
        select: recordSelect,
        orderBy: [{ recordDate: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.progressRecord.count({ where }),
      this.firstRecordDate(memberId),
    ]);
    return {
      rows: rows.map((row) => toRecordView(row, baseline)),
      total,
      page,
      pageSize,
    };
  }

  /** Registros del rango sin paginar: los consume la ficha de cliente (H26). */
  async recordsInRange(
    memberId: string,
    filter: CivilRange,
  ): Promise<ProgressRecordView[]> {
    const [rows, baseline] = await Promise.all([
      this.prisma.progressRecord.findMany({
        where: { memberId, recordDate: this.range(filter) },
        select: recordSelect,
        orderBy: [{ recordDate: 'desc' }, { id: 'asc' }],
        take: MAX_SERIES_POINTS,
      }),
      this.firstRecordDate(memberId),
    ]);
    return rows.map((row) => toRecordView(row, baseline));
  }

  /**
   * Serie temporal (H25).
   *
   * Sólo se cuentan días con dato real: un `waistCm` nulo no genera punto y el
   * eje es `recordDate` (el día medido), nunca `createdAt`.
   */
  async evolution(
    memberId: string,
    metric: ProgressMetric,
    exerciseId: string | undefined,
    from: string | null,
    to: string | null,
  ): Promise<EvolutionView> {
    const unit = metricUnit(metric);
    const filter: CivilRange = { from, to };
    const points = isBodyMetric(metric)
      ? await this.bodySeries(memberId, metric, filter)
      : await this.exerciseSeries(memberId, exerciseId as string, filter);

    const first = points[0];
    const last = points[points.length - 1];
    const baseline = first ? first.value : null;
    const latest = last ? last.value : null;
    return {
      metric,
      unit,
      points,
      baseline,
      latest,
      difference:
        points.length >= 2 && baseline !== null && latest !== null
          ? roundToTwoDecimals(latest - baseline)
          : null,
      count: points.length,
    };
  }

  /** Rango civil a filtro de Prisma; `undefined` significa «sin acotar». */
  private range(filter: CivilRange): Prisma.DateTimeFilter | undefined {
    const bounds: Prisma.DateTimeFilter = {};
    if (filter.from) {
      bounds.gte = dayValue(filter.from);
    }
    if (filter.to) {
      bounds.lte = dayValue(filter.to);
    }
    return Object.keys(bounds).length > 0 ? bounds : undefined;
  }

  private toDecimal(value: number | null | undefined): Prisma.Decimal | null {
    return value === null || value === undefined
      ? null
      : new Prisma.Decimal(value);
  }

  private async bodySeries(
    memberId: string,
    metric: ProgressMetric,
    filter: CivilRange,
  ) {
    const column = BODY_COLUMN[metric] ?? 'weightKg';
    const rows = await this.prisma.progressRecord.findMany({
      where: { memberId, recordDate: this.range(filter) },
      select: {
        recordDate: true,
        weightKg: true,
        waistCm: true,
        chestCm: true,
        armCm: true,
      },
      // Prisma 7 no admite `null` en los filtros de columna decimal, así que el
      // «distinto de null» se resuelve aquí y luego se limita la serie completa.
      // No se aplica `take` antes del filtrado: el primer dato real puede ser
      // anterior a los 365 registros más recientes.
      orderBy: { recordDate: 'asc' },
    });
    const points = rows.flatMap((row) => {
      const value = row[column];
      return value === null
        ? []
        : [
            {
              date: toCivilDate(row.recordDate),
              value: Number(value),
              reps: null,
            },
          ];
    });
    return capEvolutionPoints(points);
  }

  private async exerciseSeries(
    memberId: string,
    exerciseId: string,
    filter: CivilRange,
  ) {
    const rows = await this.prisma.progressRecord.findMany({
      where: {
        memberId,
        recordDate: this.range(filter),
        marks: { some: { exerciseId } },
      },
      select: {
        id: true,
        recordDate: true,
        marks: {
          where: { exerciseId },
          select: { weightKg: true, reps: true },
        },
      },
      orderBy: [{ recordDate: 'asc' }, { id: 'asc' }],
    });
    const points = rows.flatMap((row) =>
      row.marks.map((mark) => ({
        date: toCivilDate(row.recordDate),
        value: Number(mark.weightKg),
        reps: mark.reps,
      })),
    );
    return capEvolutionPoints(points);
  }

  private async readOne(
    tx: Prisma.TransactionClient,
    id: string,
    memberId: string,
  ): Promise<ProgressRecordView> {
    const [row, baseline] = await Promise.all([
      tx.progressRecord.findUnique({ where: { id }, select: recordSelect }),
      this.firstRecordDate(memberId, tx),
    ]);
    if (!row) {
      throw new DomainError('NOT_FOUND', 'Recurso no encontrado.');
    }
    return toRecordView(row, baseline);
  }

  /** Día del primer registro del miembro: define `isBaseline` en H24 y H25. */
  private async firstRecordDate(
    memberId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Date | null> {
    const db = tx ?? this.prisma;
    const oldest = await db.progressRecord.findFirst({
      where: { memberId },
      select: { recordDate: true },
      orderBy: { recordDate: 'asc' },
    });
    return oldest?.recordDate ?? null;
  }
}
