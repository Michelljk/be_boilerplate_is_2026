import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '@Auth/decorators';
import { UserRole } from '@PrismaClient';
import {
  MemberDirectoryQueryDto,
  MemberDirectoryResponseDto,
} from '../dto/member-directory.dto.js';
import { MemberDirectoryService } from '../services/member-directory.service.js';

/** Buscador mínimo de miembros compartido por H19/H2, sin tocar PaymentsController. */
@ApiTags('members')
@ApiBearerAuth()
@Controller('members')
@Roles(UserRole.RECEPCION_ADMIN)
export class MemberDirectoryController {
  constructor(private readonly directory: MemberDirectoryService) {}

  @Get()
  @ApiOperation({ summary: 'H19/H2. Buscar miembros para recepción' })
  @ApiOkResponse({ type: MemberDirectoryResponseDto })
  @ApiBadRequestResponse({
    description: 'search debe tener entre 2 y 60 caracteres.',
  })
  @ApiUnauthorizedResponse({ description: 'Falta un JWT válido.' })
  @ApiForbiddenResponse({ description: 'Solo recepción y administración.' })
  async search(
    @Query() query: MemberDirectoryQueryDto,
  ): Promise<MemberDirectoryResponseDto> {
    return MemberDirectoryResponseDto.fromCandidates(
      await this.directory.search(query.search),
    );
  }
}
