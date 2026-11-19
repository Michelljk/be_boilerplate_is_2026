import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PersonalSessionStatus } from '@PrismaClient';

/** Query de `GET /api/v1/personal-sessions/me` (H10 · página de 10 en 10). */
export class ListPersonalSessionsQueryDto {
  @ApiPropertyOptional({
    description: 'Filtra el historial por estado de la sesión.',
    enum: PersonalSessionStatus,
    example: PersonalSessionStatus.CONFIRMADA,
  })
  @IsOptional()
  @IsEnum(PersonalSessionStatus)
  status?: PersonalSessionStatus;

  @ApiPropertyOptional({
    description: 'Página 1-indexada.',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    description:
      'Registros por página; el PDF fija 10 y el techo del proyecto es 50.',
    minimum: 1,
    maximum: 50,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 10;
}
