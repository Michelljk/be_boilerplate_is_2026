import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Cuerpo de `POST /api/v1/reviews` (H29).
 *
 * El `memberId` nunca viene del cuerpo: se toma del JWT. `rating` es entero de
 * 1 a 5 y `comment` es opcional con tope de 500 caracteres, igual que la
 * columna `reviews.comment` (VARCHAR(500)).
 */
export class CreateReviewDto {
  @ApiProperty({
    description: 'Sesión COMPLETADA a la que el miembro asistió.',
    format: 'uuid',
  })
  @IsUUID('all', { message: 'sessionId debe ser un UUID válido.' })
  sessionId!: string;

  @ApiProperty({
    description: 'Calificación en estrellas, de 1 a 5.',
    example: 5,
    minimum: 1,
    maximum: 5,
    type: Number,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === '' || value === null ? Number.NaN : value,
  )
  @IsInt({ message: 'rating debe ser un entero entre 1 y 5.' })
  @Min(1, { message: 'rating debe ser un entero entre 1 y 5.' })
  @Max(5, { message: 'rating debe ser un entero entre 1 y 5.' })
  rating!: number;

  @ApiPropertyOptional({
    description: 'Comentario opcional sobre la sesión.',
    maxLength: 500,
    example: 'Buena energía y explicaciones claras.',
    type: String,
  })
  @IsOptional()
  @IsString({ message: 'comment debe ser texto.' })
  @MaxLength(500, { message: 'comment no puede superar 500 caracteres.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  comment?: string;
}
