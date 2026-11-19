import { ApiProperty } from '@nestjs/swagger';
import type {
  MemberProgressView,
  TrainerMemberPage,
  TrainerMemberView,
} from '../progress-views.js';
import { ExerciseMarkResponseDto } from './progress-record-response.dto.js';

/** Cliente del directorio del entrenador (H26, contrato 1). */
export class TrainerMemberResponseDto {
  @ApiProperty({ format: 'uuid' }) memberId!: string;
  @ApiProperty({ nullable: true, example: 'M-0007' })
  memberNumber!: string | null;
  @ApiProperty({ example: 'María López' }) memberName!: string;

  static fromView(row: TrainerMemberView): TrainerMemberResponseDto {
    const dto = new TrainerMemberResponseDto();
    dto.memberId = row.memberId;
    dto.memberNumber = row.memberNumber;
    dto.memberName = row.memberName;
    return dto;
  }
}

/** Respuesta paginada del directorio. */
export class TrainerMembersResponseDto {
  @ApiProperty({ type: [TrainerMemberResponseDto] })
  data!: TrainerMemberResponseDto[];
  @ApiProperty({ example: 24 }) total!: number;
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 10 }) pageSize!: number;

  static fromPage(page: TrainerMemberPage): TrainerMembersResponseDto {
    const dto = new TrainerMembersResponseDto();
    dto.data = page.rows.map((row) => TrainerMemberResponseDto.fromView(row));
    dto.total = page.total;
    dto.page = page.page;
    dto.pageSize = page.pageSize;
    return dto;
  }
}

/** Registro visto por el entrenador: usa `date`, igual que el PDF. */
export class MemberProgressRecordResponseDto {
  @ApiProperty({ example: '2026-11-10' }) date!: string;
  @ApiProperty({ example: 78.4 }) weightKg!: number;
  @ApiProperty({ nullable: true, example: 92.5 }) waistCm!: number | null;
  @ApiProperty({ nullable: true, example: 104 }) chestCm!: number | null;
  @ApiProperty({ nullable: true, example: 36.2 }) armCm!: number | null;
  @ApiProperty({ type: [ExerciseMarkResponseDto] })
  marks!: ExerciseMarkResponseDto[];
}

/** Resumen de peso de la ficha de cliente. */
export class WeightSummaryResponseDto {
  @ApiProperty({ nullable: true, example: 82.1 }) baseline!: number | null;
  @ApiProperty({ nullable: true, example: 78.4 }) latest!: number | null;
  @ApiProperty({ nullable: true, example: -3.7 }) difference!: number | null;
}

/** Ficha completa de un cliente asignado (H26, contrato 2). */
export class MemberProgressResponseDto {
  @ApiProperty({ format: 'uuid' }) memberId!: string;
  @ApiProperty({ type: [MemberProgressRecordResponseDto] })
  records!: MemberProgressRecordResponseDto[];
  @ApiProperty({ type: WeightSummaryResponseDto })
  evolution!: WeightSummaryResponseDto;

  static fromView(view: MemberProgressView): MemberProgressResponseDto {
    const dto = new MemberProgressResponseDto();
    dto.memberId = view.memberId;
    dto.records = view.records.map((record) => ({
      date: record.date,
      weightKg: record.weightKg,
      waistCm: record.waistCm,
      chestCm: record.chestCm,
      armCm: record.armCm,
      marks: record.marks.map((mark) => ExerciseMarkResponseDto.fromMark(mark)),
    }));
    dto.evolution = {
      baseline: view.evolution.baseline,
      latest: view.evolution.latest,
      difference: view.evolution.difference,
    };
    return dto;
  }
}
