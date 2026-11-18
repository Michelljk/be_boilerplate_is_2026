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
  DateRangeDto,
  MonthRangeDto,
  TrainerPerformanceQueryDto,
} from './dto/index.js';
import { ReportsService } from './reports.service.js';

@ApiTags('reports')
@ApiBearerAuth()
@Roles(UserRole.RECEPCION_ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('occupancy')
  @ApiOperation({ summary: 'Reporte de ocupación por clase (H36)' })
  @ApiOkResponse({
    description: 'Capacidad, reservas confirmadas y ocupación por clase.',
  })
  @ApiBadRequestResponse({
    description: 'Rango inválido o superior a 12 meses.',
  })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({ description: 'Acceso denegado.' })
  occupancy(@Query() query: DateRangeDto) {
    return this.reports.occupancy(query.from, query.to);
  }

  @Get('income')
  @ApiOperation({ summary: 'Reporte de ingresos por concepto (H37)' })
  @ApiOkResponse({ description: 'Total USD y desglose de pagos pagados.' })
  @ApiBadRequestResponse({
    description: 'Rango inválido o superior a 12 meses.',
  })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({ description: 'Acceso denegado.' })
  income(@Query() query: DateRangeDto) {
    return this.reports.income(query.from, query.to);
  }

  @Get('retention')
  @ApiOperation({
    summary: 'Tasas mensuales de renovación y cancelación (H38)',
  })
  @ApiOkResponse({
    description: 'Vencimientos, renovaciones y cancelaciones por mes.',
  })
  @ApiBadRequestResponse({
    description: 'Rango inválido o superior a 12 meses.',
  })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({ description: 'Acceso denegado.' })
  retention(@Query() query: MonthRangeDto) {
    return this.reports.retention(query.from, query.to);
  }

  @Get('trainer-performance')
  @ApiOperation({ summary: 'Desempeño de entrenadores (H39)' })
  @ApiOkResponse({
    description: 'Sesiones completadas y promedio compartido de H30.',
  })
  @ApiBadRequestResponse({ description: 'Rango u orden inválido.' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({ description: 'Acceso denegado.' })
  trainerPerformance(@Query() query: TrainerPerformanceQueryDto) {
    return this.reports.trainerPerformance(
      query.from,
      query.to,
      query.sortBy,
      query.order,
    );
  }
}
