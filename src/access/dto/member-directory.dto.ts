import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import type { MemberDirectoryCandidate } from '../repositories/member.repository.js';

/** H19/H2: contrato independiente del buscador enriquecido de H13. */
export class MemberDirectoryQueryDto {
  @ApiProperty({
    description: 'Texto de 2 a 60 caracteres para nombre o memberNumber.',
    minLength: 2,
    maxLength: 60,
    example: 'María',
  })
  @IsString({ message: 'search debe ser texto.' })
  @MinLength(2, { message: 'La búsqueda debe tener al menos 2 caracteres.' })
  @MaxLength(60, { message: 'La búsqueda no puede superar 60 caracteres.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  search!: string;
}

export class MemberDirectoryItemDto {
  @ApiProperty({ format: 'uuid' })
  memberId!: string;

  @ApiProperty({ example: 'M-0001' })
  memberNumber!: string;

  @ApiProperty({ example: 'María Hernández' })
  fullName!: string;

  static fromCandidate(
    candidate: MemberDirectoryCandidate,
  ): MemberDirectoryItemDto {
    return {
      memberId: candidate.memberId,
      memberNumber: candidate.memberNumber,
      fullName: candidate.fullName,
    };
  }
}

export class MemberDirectoryResponseDto {
  @ApiProperty({ type: [MemberDirectoryItemDto], maxItems: 10 })
  data!: MemberDirectoryItemDto[];

  static fromCandidates(
    candidates: MemberDirectoryCandidate[],
  ): MemberDirectoryResponseDto {
    return {
      data: candidates.map((candidate) => MemberDirectoryItemDto.fromCandidate(candidate)),
    };
  }
}
