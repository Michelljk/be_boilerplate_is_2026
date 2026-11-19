import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@PrismaClient';
import { Roles } from '@Auth/decorators';
import { TrainingCatalogService } from '../services/training-catalog.service.js';
import { TrainingCatalogQueryDto } from '../dto/training-catalog-query.dto.js';

/**
 * Catálogo de solo lectura: lo consumen entrenador (H22) y miembro (H24/H25).
 *
 * El listado de clientes asignados NO se repite aquí: su dueño es H26
 * (`GET /trainers/me/members` en el dominio de progreso), que ya devuelve la
 * búsqueda paginada que necesita la pantalla.
 */
@ApiTags('training-catalogs')
@ApiBearerAuth()
@Roles(UserRole.ENTRENADOR, UserRole.MIEMBRO)
@Controller()
export class TrainingCatalogController {
  constructor(private readonly service: TrainingCatalogService) {}
  @Get('exercises')
  @ApiOperation({
    summary: 'Consulta el catálogo activo de ejercicios para H22, H24 y H25',
  })
  exercises(@Query() query: TrainingCatalogQueryDto) {
    return this.service.exercises(query.page, query.pageSize);
  }
}
