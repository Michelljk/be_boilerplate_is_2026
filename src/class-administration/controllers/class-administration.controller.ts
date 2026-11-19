import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { UserRole, type User } from '@PrismaClient';
import {
  CancelClassSessionDto,
  CancelAdminClassSessionResponseDto,
  AdminClassSessionResponseDto,
  ClassTemplateResponseDto,
  CreateClassTemplateDto,
  GenerateClassSessionsDto,
  GenerateClassSessionsResponseDto,
  GeneratedClassSessionDto,
  RoomCatalogDto,
  TrainerCatalogDto,
  TrainerCatalogPageDto,
  UpdateClassSessionDto,
  UpdateClassTemplateDto,
  AdminClassSessionsQueryDto,
  AdminClassSessionsPageDto,
} from '../dto/index.js';
import { ClassAdministrationService } from '../services/index.js';

@ApiTags('Creación, edición y cancelación de clases y sesiones')
@ApiBearerAuth()
@Roles(UserRole.RECEPCION_ADMIN)
@Controller()
export class ClassAdministrationController {
  constructor(private readonly service: ClassAdministrationService) {}

  @Get('admin/class-sessions')
  @ApiOperation({ summary: 'Listar sesiones fechadas para administración' })
  @ApiOkResponse({ type: AdminClassSessionsPageDto })
  async listSessions(
    @Query() query: AdminClassSessionsQueryDto,
  ): Promise<AdminClassSessionsPageDto> {
    const page = await this.service.listSessions(query);
    return {
      data: page.rows.map((row) =>
        AdminClassSessionResponseDto.fromEntity(row),
      ),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }
  @Get('admin/class-sessions/:id')
  @ApiOperation({ summary: 'Consultar detalle administrativo de una sesión' })
  @ApiOkResponse({ type: AdminClassSessionResponseDto })
  @ApiNotFoundResponse({ description: 'La sesión no existe.' })
  async getSession(
    @Param('id') id: string,
  ): Promise<AdminClassSessionResponseDto> {
    return AdminClassSessionResponseDto.fromEntity(
      await this.service.getSession(id),
    );
  }
  @Get('class-templates')
  @ApiOperation({ summary: 'Listar plantillas semanales para administración' })
  @ApiOkResponse({ type: [ClassTemplateResponseDto] })
  async listTemplates(): Promise<ClassTemplateResponseDto[]> {
    return (await this.service.listTemplates()).map((template) =>
      ClassTemplateResponseDto.fromEntity(template),
    );
  }

  @Post('class-templates')
  @ApiOperation({ summary: 'Crear una plantilla semanal de clase' })
  @ApiCreatedResponse({ type: ClassTemplateResponseDto })
  @ApiBadRequestResponse({
    description: 'Body inválido o con propiedades no permitidas.',
  })
  @ApiConflictResponse({ description: 'Existe un conflicto de horario.' })
  @ApiNotFoundResponse({ description: 'La sala o el entrenador no existe.' })
  async createTemplate(
    @Body() dto: CreateClassTemplateDto,
  ): Promise<ClassTemplateResponseDto> {
    return ClassTemplateResponseDto.fromEntity(
      await this.service.createTemplate(dto),
    );
  }

  @Patch('class-templates/:id')
  @ApiOperation({ summary: 'Editar una plantilla semanal' })
  @ApiOkResponse({ type: ClassTemplateResponseDto })
  @ApiBadRequestResponse({ description: 'Identificador o body inválido.' })
  @ApiConflictResponse({
    description: 'Existe un conflicto de horario o de capacidad.',
  })
  @ApiNotFoundResponse({
    description: 'La plantilla, sala o entrenador no existe.',
  })
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateClassTemplateDto,
  ): Promise<ClassTemplateResponseDto> {
    return ClassTemplateResponseDto.fromEntity(
      await this.service.updateTemplate(id, dto),
    );
  }

  @Post('class-templates/:id/sessions')
  @ApiOperation({ summary: 'Generar sesiones fechadas desde una plantilla' })
  @ApiCreatedResponse({ type: GenerateClassSessionsResponseDto })
  @ApiBadRequestResponse({
    description: 'Rango calendario inválido o fuera de 1–28 días.',
  })
  @ApiConflictResponse({ description: 'Existe un conflicto de horario.' })
  @ApiNotFoundResponse({ description: 'La plantilla no existe.' })
  async generateSessions(
    @Param('id') id: string,
    @Body() dto: GenerateClassSessionsDto,
  ): Promise<GenerateClassSessionsResponseDto> {
    const generated = await this.service.generateSessions(id, dto);
    const response = new GenerateClassSessionsResponseDto();
    response.created = generated.created.length;
    response.sessions = generated.created.map((session) =>
      GeneratedClassSessionDto.fromEntity(session),
    );
    return response;
  }

  @Patch('class-sessions/:id')
  @ApiOperation({ summary: 'Editar una sesión futura' })
  @ApiOkResponse({ type: AdminClassSessionResponseDto })
  @ApiBadRequestResponse({ description: 'Identificador o body inválido.' })
  @ApiConflictResponse({
    description: 'Conflicto de horario o cupo menor a reservas.',
  })
  @ApiNotFoundResponse({
    description: 'La sesión, sala o entrenador no existe.',
  })
  async updateSession(
    @Param('id') id: string,
    @Body() dto: UpdateClassSessionDto,
  ): Promise<AdminClassSessionResponseDto> {
    return AdminClassSessionResponseDto.fromEntity(
      await this.service.updateSession(id, dto),
    );
  }

  @Patch('class-sessions/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar una sesión por decisión del gimnasio' })
  @ApiOkResponse({ type: CancelAdminClassSessionResponseDto })
  @ApiBadRequestResponse({ description: 'Identificador o motivo inválido.' })
  @ApiConflictResponse({ description: 'No se puede cancelar esta sesión.' })
  @ApiNotFoundResponse({ description: 'La sesión no existe.' })
  async cancelSession(
    @Param('id') id: string,
    @Body() dto: CancelClassSessionDto,
    @CurrentUser() user: User,
  ): Promise<CancelAdminClassSessionResponseDto> {
    const result = await this.service.cancelSession(id, dto, user.id);
    const response = new CancelAdminClassSessionResponseDto();
    response.id = result.session.id;
    response.status = 'CANCELADA';
    response.cancelledReservations = result.cancelledReservations;
    response.cancelledAt =
      result.session.cancelledAt?.toISOString() ?? new Date().toISOString();
    return response;
  }

  @Get('rooms')
  @Roles(UserRole.MIEMBRO, UserRole.RECEPCION_ADMIN)
  @ApiOperation({ summary: 'Listar salas disponibles para clases' })
  @ApiOkResponse({ type: [RoomCatalogDto] })
  async listRooms(): Promise<RoomCatalogDto[]> {
    const rooms = await this.service.listRooms();
    return rooms.map((room) => RoomCatalogDto.fromEntity(room));
  }

  @Get('trainers')
  @ApiOperation({ summary: 'Listar entrenadores activos' })
  // H10: el miembro también consulta este catálogo para elegir con quién
  // agendar; el resto del controlador sigue siendo exclusivo de recepción.
  @Roles(UserRole.MIEMBRO, UserRole.RECEPCION_ADMIN)
  @ApiOkResponse({ type: TrainerCatalogPageDto })
  async listTrainers(): Promise<TrainerCatalogPageDto> {
    const trainers = await this.service.listTrainers();
    return {
      data: trainers.map((trainer) => {
        const response = new TrainerCatalogDto();
        response.id = trainer.id;
        response.name = trainer.name;
        return response;
      }),
    };
  }
}
