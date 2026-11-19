import { ApiProperty } from '@nestjs/swagger';
import { CheckInMembershipStatus } from '@PrismaClient';
import type { MemberSummary } from '../services/member-search.service.js';
import type { CheckInSnapshot } from '../repositories/check-in.repository.js';
import type { CheckInHistoryService } from '../services/check-in-history.service.js';

/** Estado de la membresía calculado por el servidor (H14 · Backend 1). */
export class MembershipStatusDto {
  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description:
      'ID de la membresía vigente para iniciar su renovación; null si no hay una vigente.',
  })
  membershipId!: string | null;

  @ApiProperty({
    enum: CheckInMembershipStatus,
    enumName: 'CheckInMembershipStatus',
    description: 'VIGENTE, VENCIDA o SIN_MEMBRESIA según la regla canónica.',
    example: CheckInMembershipStatus.VIGENTE,
  })
  status!: CheckInMembershipStatus;

  @ApiProperty({
    nullable: true,
    format: 'date',
    description: 'Último día civil de vencimiento conocido; null si no hay.',
    example: '2026-12-31',
  })
  endsOn: string | null;
}

export class MemberMatchDto {
  @ApiProperty({ format: 'uuid' })
  memberId!: string;

  @ApiProperty({ example: 'M-0001' })
  memberNumber!: string;

  @ApiProperty({ example: 'María Hernández' })
  memberName!: string;

  @ApiProperty({ type: MembershipStatusDto })
  membership!: MembershipStatusDto;

  static fromSummary(summary: MemberSummary): MemberMatchDto {
    const membership: MembershipStatusDto = {
      membershipId: summary.membership.membershipId,
      status: summary.membership.status,
      endsOn: summary.membership.endsOn,
    };

    return {
      memberId: summary.memberId,
      memberNumber: summary.memberNumber,
      memberName: summary.memberName,
      membership,
    };
  }
}

export class MemberSearchResponseDto {
  @ApiProperty({
    type: [MemberMatchDto],
    description: 'Máximo 20 coincidencias ordenadas por nombre.',
  })
  data!: MemberMatchDto[];

  static fromSummaries(summaries: MemberSummary[]): MemberSearchResponseDto {
    return { data: summaries.map((item) => MemberMatchDto.fromSummary(item)) };
  }
}

export class CheckInCreatedDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'M-0001' })
  memberNumber!: string;

  @ApiProperty({ example: 'María Hernández' })
  memberName!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Instante UTC asignado por el servidor (H13 · Backend 1).',
  })
  checkedInAt!: string;

  @ApiProperty({
    enum: CheckInMembershipStatus,
    enumName: 'CheckInMembershipStatus',
    description: 'Estado de la membresía en el momento del ingreso.',
  })
  membershipStatus!: CheckInMembershipStatus;

  @ApiProperty({
    description:
      'true cuando recepción confirmó el ingreso con la membresía no vigente.',
  })
  expiredConfirmed!: boolean;

  static fromSnapshot(snapshot: CheckInSnapshot): CheckInCreatedDto {
    return {
      id: snapshot.id,
      memberNumber: snapshot.memberNumber,
      memberName: snapshot.memberName,
      checkedInAt: snapshot.checkedInAt.toISOString(),
      membershipStatus: snapshot.membershipStatus,
      expiredConfirmed: snapshot.expiredConfirmed,
    };
  }
}

export class CheckInHistoryItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'M-0001' })
  memberNumber!: string;

  @ApiProperty({ example: 'María Hernández' })
  memberName!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Instante UTC del ingreso.',
  })
  checkedInAt!: string;

  @ApiProperty({
    enum: CheckInMembershipStatus,
    enumName: 'CheckInMembershipStatus',
    description: 'Estado de la membresía guardado al ingresar.',
  })
  membershipStatus!: CheckInMembershipStatus;

  @ApiProperty({ description: 'Si recepción confirmó una membresía vencida.' })
  expiredConfirmed!: boolean;

  static fromRow(
    row: Awaited<ReturnType<CheckInHistoryService['history']>>['rows'][number],
  ): CheckInHistoryItemDto {
    return {
      id: row.id,
      memberNumber: row.memberNumber,
      memberName: row.memberName,
      checkedInAt: row.checkedInAt.toISOString(),
      membershipStatus: row.membershipStatus,
      expiredConfirmed: row.expiredConfirmed,
    };
  }
}

export class CheckInHistoryResponseDto {
  @ApiProperty({ type: [CheckInHistoryItemDto] })
  data!: CheckInHistoryItemDto[];

  @ApiProperty({ example: 137, description: 'Total de ingresos del filtro.' })
  total!: number;

  @ApiProperty({ example: 1, minimum: 1 })
  page!: number;

  @ApiProperty({ example: 20, minimum: 1, maximum: 20 })
  pageSize!: number;

  static fromPage(
    page: Awaited<ReturnType<CheckInHistoryService['history']>>,
  ): CheckInHistoryResponseDto {
    return {
      data: page.rows.map((row) => CheckInHistoryItemDto.fromRow(row)),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }
}
