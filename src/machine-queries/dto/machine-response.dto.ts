import { ApiProperty } from '@nestjs/swagger';
import { MachineStatus, type Machine } from '../../generated/prisma/client.js';

export class MachineAvailabilityDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Caminadora' })
  name!: string;

  @ApiProperty({ example: 'Cardio' })
  type!: string;

  @ApiProperty({ example: 'Sala principal' })
  location!: string;

  @ApiProperty({ enum: MachineStatus, example: MachineStatus.DISPONIBLE })
  status!: MachineStatus;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-08T23:47:55.000Z',
  })
  updatedAt!: string;

  static fromEntity(
    machine: Pick<
      Machine,
      'id' | 'name' | 'type' | 'location' | 'status' | 'updatedAt'
    >,
  ): MachineAvailabilityDto {
    return {
      id: machine.id,
      name: machine.name,
      type: machine.type,
      location: machine.location,
      status: machine.status,
      updatedAt: machine.updatedAt.toISOString(),
    };
  }
}

export class MachineListResponseDto {
  @ApiProperty({ type: [MachineAvailabilityDto] })
  data!: MachineAvailabilityDto[];

  @ApiProperty({ example: 4, minimum: 0 })
  total!: number;

  @ApiProperty({ example: 1, minimum: 1 })
  page!: number;

  @ApiProperty({ example: 20, minimum: 1, maximum: 50 })
  pageSize!: number;
}
