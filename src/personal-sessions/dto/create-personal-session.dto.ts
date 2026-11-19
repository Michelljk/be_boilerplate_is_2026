import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** Body de `POST /api/v1/personal-sessions` (H10). */
export class CreatePersonalSessionDto {
  @ApiProperty({
    description:
      'Espacio LIBRE del entrenador. Cualquier UUID válido; el memberId se toma del JWT.',
    format: 'uuid',
    example: '7d9f5a32-5a1f-4e44-9c34-9d83b3ac4bd2',
  })
  @IsUUID()
  slotId!: string;
}
