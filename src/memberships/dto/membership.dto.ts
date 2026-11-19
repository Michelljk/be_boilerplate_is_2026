import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { MembershipStatus, PlanStatus, PlanType } from '@PrismaClient';
import {
  civilDay,
  membershipStatusLabel,
  type EligibilityInput,
} from '../domain/eligibility.js';
import type {
  MembershipCardRow,
  MembershipPlanRow,
} from '../repositories/memberships.repository.js';

const PLAN_TYPES = [
  PlanType.MONTHLY,
  PlanType.QUARTERLY,
  PlanType.BY_CLASSES,
] as const;
const PLAN_STATUSES = [PlanStatus.ACTIVO, PlanStatus.INACTIVO] as const;

/** Alta de plan (H3). El precio entra como texto para no perder céntimos. */
export class PlanWriteDto {
  @ApiProperty({ minLength: 3, maxLength: 80 })
  @IsString()
  @Length(3, 80)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @ApiProperty({ enum: PLAN_TYPES })
  @IsIn(PLAN_TYPES)
  type!: (typeof PLAN_TYPES)[number];

  @ApiProperty({ example: '25.00' })
  @Matches(/^\d{1,8}(\.\d{1,2})?$/, { message: 'priceUsd debe ser monetario.' })
  priceUsd!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMonths?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  classCredits?: number | null;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  benefits!: string[];

  @ApiProperty({ enum: PLAN_STATUSES })
  @IsIn(PLAN_STATUSES)
  status!: (typeof PLAN_STATUSES)[number];
}

/** Edición parcial de plan (H3): el servicio mezcla el body con la fila actual. */
export class UpdatePlanDto {
  @ApiPropertyOptional({ minLength: 3, maxLength: 80 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(3, 80)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiPropertyOptional({ enum: PLAN_TYPES })
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(PLAN_TYPES)
  type?: (typeof PLAN_TYPES)[number];

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @Matches(/^\d{1,8}(\.\d{1,2})?$/, { message: 'priceUsd debe ser monetario.' })
  priceUsd?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMonths?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  classCredits?: number | null;

  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @IsString({ each: true })
  benefits?: string[];

  @ApiPropertyOptional({ enum: PLAN_STATUSES })
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(PLAN_STATUSES)
  status?: (typeof PLAN_STATUSES)[number];
}

/** Compra (H2): el miembro se identifica por número; nunca llega el monto. */
export class PurchaseDto {
  @ApiProperty({ minLength: 1, maxLength: 30 })
  @IsString()
  @Length(1, 30)
  memberNumber!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  planId!: string;
}

/** Renovación (H2): body con el plan contratado sobre la membresa indicada. */
export class RenewalDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  planId!: string;
}

/** Catálogo de planes con la forma que muestran H2 y H3. */
export class PlanResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: PLAN_TYPES }) type!: string;
  @ApiProperty({ example: '25.00' }) priceUsd!: string;
  @ApiProperty({ nullable: true }) durationMonths!: number | null;
  @ApiProperty({ nullable: true }) durationDays!: number | null;
  @ApiProperty({ nullable: true }) classCredits!: number | null;
  @ApiProperty({ type: [String] }) benefits!: string[];
  @ApiProperty({ enum: PLAN_STATUSES }) status!: string;

  static fromRow(row: MembershipPlanRow): PlanResponseDto {
    const dto = new PlanResponseDto();
    dto.id = row.id;
    dto.name = row.name;
    dto.type = row.type;
    dto.priceUsd = row.priceUsd.toFixed(2);
    dto.durationMonths = row.durationMonths;
    dto.durationDays = row.durationDays;
    dto.classCredits = row.credits;
    dto.benefits = row.benefits;
    dto.status = row.status;
    return dto;
  }
}

/** Respuesta de `GET /membership-plans` (H3). */
export class PlanListResponseDto {
  @ApiProperty({ type: [PlanResponseDto] }) data!: PlanResponseDto[];
}

/** Tarjeta «Mi membresía» (H1). `membership` es null cuando no existe. */
export class MembershipCardResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) planId!: string;
  @ApiProperty() planName!: string;
  @ApiProperty({ type: [String] }) benefits!: string[];
  @ApiProperty({ example: '2026-11-01' }) startsOn!: string;
  @ApiProperty({ example: '2026-12-01' }) endsOn!: string;
  @ApiProperty({ enum: PLAN_TYPES }) planType!: string;
  @ApiProperty({ nullable: true }) creditsRemaining!: number | null;
  @ApiProperty({ enum: Object.values(MembershipStatus) }) status!: string;

  /**
   * La etiqueta se recalcula con la regla canónica en cada lectura. La columna
   * `memberships.status` persiste el mismo valor para poder consultar y para el
   * aviso de vencimiento (H31); así la tarjeta nunca muestra un estado rezagado
   * dentro del mismo día.
   */
  static fromRow(
    row: MembershipCardRow,
    today: string,
  ): MembershipCardResponseDto {
    const facts: EligibilityInput = {
      memberId: row.memberId,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      creditsRemaining: row.creditsRemaining,
      plan: row.plan,
      payment: row.payment,
    };
    const dto = new MembershipCardResponseDto();
    dto.id = row.id;
    dto.planId = row.planId;
    dto.planName = row.plan.name;
    dto.benefits = row.plan.benefits;
    dto.startsOn = civilDay(row.startsOn);
    dto.endsOn = civilDay(row.endsOn);
    dto.planType = row.plan.type;
    dto.creditsRemaining = row.creditsRemaining;
    dto.status = membershipStatusLabel(facts, today);
    return dto;
  }
}

/** Envolvente de H1: `{ membership: null | {...} }` sin inventar fechas. */
export class MyMembershipResponseDto {
  @ApiProperty({ type: MembershipCardResponseDto, nullable: true })
  membership!: MembershipCardResponseDto | null;
}

/** Alta de membresa (H2): `startsOn`/`endsOn` se resuelven al pagar. */
export class PurchaseResponseDto {
  @ApiProperty({ format: 'uuid' }) requestId!: string;
  @ApiProperty({ format: 'uuid' }) paymentId!: string;
  @ApiProperty({ example: 'PENDIENTE_PAGO' }) status!: string;
  @ApiProperty({ nullable: true }) startsOn!: string | null;
  @ApiProperty({ nullable: true }) endsOn!: string | null;
}

/** Renovación (H2): informa el fin esperado del nuevo tramo. */
export class RenewalResponseDto {
  @ApiProperty({ format: 'uuid' }) requestId!: string;
  @ApiProperty({ format: 'uuid' }) membershipId!: string;
  @ApiProperty({ format: 'uuid' }) paymentId!: string;
  @ApiProperty({ example: 'PENDIENTE_PAGO' }) status!: string;
  @ApiProperty({ example: '2027-02-28' }) expectedEndsOn!: string;
}
