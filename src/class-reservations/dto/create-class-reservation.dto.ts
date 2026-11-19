import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateClassReservationDto {
  @ApiProperty({
    description: 'Identificador UUID de la sesión grupal futura.',
    format: 'uuid',
    example: '7d9f5a32-5a1f-4e44-9c34-9d83b3ac4bd2',
  })
  @IsUUID()
  sessionId!: string;
}
