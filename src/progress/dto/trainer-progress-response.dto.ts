
import { ApiProperty } from '@nestjs/swagger';

/**
 * Tipos de lectura utilizados por H26.
 */
export interface TrainerMemberView {
  memberId: string;
  memberNumber: string | null;
  memberName: string;
}

export interface TrainerMemberPage {
  rows: TrainerMemberView[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProgressMarkView {
  exerciseId: string;
  weightKg: number;
  reps: number;
}

export interface MemberProgressRecord {
  date: string;
  weightKg: number;
  waistCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  marks: ProgressMarkView[];
}

export interface MemberProgressView {
  memberId: string;
  records: MemberProgressRecord[];
  evolution: {
    baseline: number | null;
    latest: number | null;
    difference: number | null;
  };
}

/**
 * H26: miembro asignado a un entrenador.
 */
export class TrainerMemberResponseDto {
  @ApiProperty({ format: 'uuid' })
  memberId!: string;

  @ApiProperty({
    nullable: true,
    example: 'M-0007',
  })
  memberNumber!: string | null;

  @ApiProperty({ example: 'María López' })
  memberName!: string;

  static fromView(
    row: TrainerMemberView,
  ): TrainerMemberResponseDto {
    return {
      memberId: row.memberId,
      memberNumber: row.memberNumber,
      memberName: row.memberName,
    };
  }
}

/**
 * H26: listado paginado de miembros asignados.
 */
export class TrainerMembersResponseDto {
  @ApiProperty({ type: [TrainerMemberResponseDto] })
  data!: TrainerMemberResponseDto[];

  @ApiProperty({ example: 24 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  pageSize!: number;

  static fromPage(
    page: TrainerMemberPage,
  ): TrainerMembersResponseDto {
    return {
      data: page.rows.map((row) =>
        TrainerMemberResponseDto.fromView(row),
      ),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }
}

/**
 * Marca de ejercicio consultada por el entrenador.
 */
export class TrainerExerciseMarkResponseDto {
  @ApiProperty({ format: 'uuid' })
  exerciseId!: string;

  @ApiProperty({ example: 62.5 })
  weightKg!: number;

  @ApiProperty({ example: 10 })
  reps!: number;
}

/**
 * Registro de progreso de un miembro asignado.
 */
export class MemberProgressRecordResponseDto {
  @ApiProperty({
    example: '2026-11-10',
    format: 'date',
  })
  date!: string;

  @ApiProperty({ example: 78.4 })
  weightKg!: number;

  @ApiProperty({ nullable: true, example: 92.5 })
  waistCm!: number | null;

  @ApiProperty({ nullable: true, example: 104 })
  chestCm!: number | null;

  @ApiProperty({ nullable: true, example: 36.2 })
  armCm!: number | null;

  @ApiProperty({
    type: [TrainerExerciseMarkResponseDto],
  })
  marks!: TrainerExerciseMarkResponseDto[];
}

/**
 * Resumen de evolución del peso corporal.
 */
export class WeightSummaryResponseDto {
  @ApiProperty({ nullable: true, example: 82.1 })
  baseline!: number | null;

  @ApiProperty({ nullable: true, example: 78.4 })
  latest!: number | null;

  @ApiProperty({ nullable: true, example: -3.7 })
  difference!: number | null;
}

/**
 * H26: ficha de progreso de un miembro asignado.
 */
export class MemberProgressResponseDto {
  @ApiProperty({ format: 'uuid' })
  memberId!: string;

  @ApiProperty({
    type: [MemberProgressRecordResponseDto],
  })
  records!: MemberProgressRecordResponseDto[];

  @ApiProperty({ type: WeightSummaryResponseDto })
  evolution!: WeightSummaryResponseDto;

  static fromView(
    view: MemberProgressView,
  ): MemberProgressResponseDto {
    return {
      memberId: view.memberId,
      records: view.records.map((record) => ({
        date: record.date,
        weightKg: record.weightKg,
        waistCm: record.waistCm,
        chestCm: record.chestCm,
        armCm: record.armCm,
        marks: record.marks.map((mark) => ({
          exerciseId: mark.exerciseId,
          weightKg: mark.weightKg,
          reps: mark.reps,
        })),
      })),
      evolution: {
        baseline: view.evolution.baseline,
        latest: view.evolution.latest,
        difference: view.evolution.difference,
      },
    };
  }
}
