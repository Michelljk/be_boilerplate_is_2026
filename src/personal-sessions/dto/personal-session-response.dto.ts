import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PaymentStatus,
  PersonalSessionStatus,
  SlotStatus,
} from '@PrismaClient';
import type {
  BookedSessionRecord,
  CancelledSessionRecord,
  PersonalSessionPageRecord,
  PersonalSessionRecord,
  TrainerSlotOption,
} from '../repositories/index.js';

const isoDate = (value: Date): string => value.toISOString();

/** Espacio LIBRE del entrenador (H10 · GET /trainers/:trainerId/slots). */
export class TrainerSlotOptionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  endsAt!: string;

  static fromRecord(record: TrainerSlotOption): TrainerSlotOptionDto {
    const dto = new TrainerSlotOptionDto();
    dto.id = record.id;
    dto.startsAt = isoDate(record.startsAt);
    dto.endsAt = isoDate(record.endsAt);
    return dto;
  }
}

export class TrainerSlotListResponseDto {
  @ApiProperty({ type: [TrainerSlotOptionDto] })
  data!: TrainerSlotOptionDto[];

  static fromRecords(records: TrainerSlotOption[]): TrainerSlotListResponseDto {
    const dto = new TrainerSlotListResponseDto();
    dto.data = records.map((record) => TrainerSlotOptionDto.fromRecord(record));
    return dto;
  }
}

/** Cobro generado al confirmar la sesión (H10 · criterio 4). */
export class SessionPaymentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    description: 'Monto en USD con dos decimales.',
    example: 10,
    type: Number,
  })
  amountUsd!: number;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PENDIENTE })
  status!: PaymentStatus;
}

/** Fila de «Mis sesiones». */
export class PersonalSessionItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Ana Pérez' })
  trainerName!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  endsAt!: string;

  @ApiProperty({ enum: PersonalSessionStatus })
  status!: PersonalSessionStatus;

  static fromRecord(record: PersonalSessionRecord): PersonalSessionItemDto {
    const dto = new PersonalSessionItemDto();
    dto.id = record.id;
    dto.trainerName = record.trainerName;
    dto.startsAt = isoDate(record.startsAt);
    dto.endsAt = isoDate(record.endsAt);
    dto.status = record.status;
    return dto;
  }
}

export class PersonalSessionListResponseDto {
  @ApiProperty({ type: [PersonalSessionItemDto] })
  data!: PersonalSessionItemDto[];

  @ApiProperty({ example: 12 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  pageSize!: number;

  static fromPage(
    page: PersonalSessionPageRecord,
    pageNumber: number,
    pageSize: number,
  ): PersonalSessionListResponseDto {
    const dto = new PersonalSessionListResponseDto();
    dto.data = page.items.map((item) => PersonalSessionItemDto.fromRecord(item));
    dto.total = page.total;
    dto.page = pageNumber;
    dto.pageSize = pageSize;
    return dto;
  }
}

/** Respuesta 201 de `POST /api/v1/personal-sessions` (H10). */
export class BookedPersonalSessionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Ana Pérez' })
  trainerName!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  endsAt!: string;

  @ApiProperty({
    enum: [PersonalSessionStatus.CONFIRMADA],
    example: PersonalSessionStatus.CONFIRMADA,
  })
  status!: PersonalSessionStatus;

  @ApiProperty({ type: SessionPaymentDto })
  payment!: SessionPaymentDto;

  static fromRecord(record: BookedSessionRecord): BookedPersonalSessionDto {
    const dto = new BookedPersonalSessionDto();
    dto.id = record.id;
    dto.trainerName = record.trainerName;
    dto.startsAt = isoDate(record.startsAt);
    dto.endsAt = isoDate(record.endsAt);
    dto.status = record.status;
    dto.payment = {
      id: record.payment.id,
      amountUsd: record.payment.amountUsd,
      status: record.payment.status,
    };
    return dto;
  }
}

/** Respuesta 200 de `PATCH /api/v1/personal-sessions/:id/cancel` (H11). */
export class CancelledPersonalSessionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    enum: [PersonalSessionStatus.CANCELADA],
    example: PersonalSessionStatus.CANCELADA,
  })
  status!: PersonalSessionStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  cancelledAt!: string;

  @ApiProperty({
    enum: [SlotStatus.LIBRE, SlotStatus.RESERVADO],
    description: 'Estado del horario tras la cancelación; LIBRE en el caso normal.',
    example: SlotStatus.LIBRE,
  })
  slotStatus!: SlotStatus;

  @ApiPropertyOptional({
    enum: PaymentStatus,
    nullable: true,
    description:
      'ANULADO cuando el cobro estaba PENDIENTE; PAGADO si ya estaba pagado; null si la sesión no tenía cobro.',
  })
  paymentStatus!: PaymentStatus | null;

  static fromRecord(record: CancelledSessionRecord): CancelledPersonalSessionDto {
    const dto = new CancelledPersonalSessionDto();
    dto.id = record.id;
    dto.status = record.status;
    dto.cancelledAt = isoDate(record.cancelledAt);
    dto.slotStatus = record.slotStatus;
    dto.paymentStatus = record.paymentStatus;
    return dto;
  }
}
