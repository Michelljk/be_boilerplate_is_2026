import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import type { User } from '@PrismaClient';
import { TrainingCatalogService } from '../services/training-catalog.service.js';
import { TrainingCatalogQueryDto } from '../dto/training-catalog-query.dto.js';
@ApiTags('training-catalogs')
@ApiBearerAuth()
@Roles('ENTRENADOR')
@Controller()
export class TrainingCatalogController {
  constructor(private readonly service: TrainingCatalogService) {}
  @Get('trainers/me/members')
  @ApiOperation({
    summary: 'Consulta exclusivamente los miembros asignados al entrenador',
  })
  assignedMembers(@CurrentUser() user: User) {
    return this.service.assignedMembers(user.id);
  }
  @Get('exercises')
  @ApiOperation({
    summary: 'Consulta el catálogo activo de ejercicios para H22',
  })
  exercises(@Query() query: TrainingCatalogQueryDto) {
    return this.service.exercises(query.page, query.pageSize);
  }
}
