import { ApiProperty } from '@nestjs/swagger';
import type { SlotStatus, TrainerSlot } from '@PrismaClient';

export class TrainerSlotResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  startsAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  endsAt!: Date;

  @ApiProperty({ enum: ['LIBRE', 'RESERVADO'], example: 'LIBRE' })
  status!: SlotStatus;

  static fromEntity(slot: TrainerSlot): TrainerSlotResponseDto {
    return {
      id: slot.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      status: slot.status,
    };
  }
}

export class TrainerSlotListResponseDto {
  @ApiProperty({ type: [TrainerSlotResponseDto] })
  data!: TrainerSlotResponseDto[];

  static fromEntities(slots: TrainerSlot[]): TrainerSlotListResponseDto {
    return {
      data: slots.map((slot) => TrainerSlotResponseDto.fromEntity(slot)),
    };
  }
}
