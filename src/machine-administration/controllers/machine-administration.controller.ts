import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { MachineStatus, type User } from '@PrismaClient';
import { MachineAdministrationService } from '../services/index.js';
import {
  ChangeMachineStatusDto,
  ChangeMachineStatusResponseDto,
  CompleteMaintenanceDto,
  CompleteMaintenanceParamsDto,
  CompleteMaintenanceResponseDto,
  MachineIdParamsDto,
  OpenMaintenanceDto,
  OpenMaintenanceResponseDto,
} from '../dto/index.js';

@ApiTags('machine-administration')
@ApiBearerAuth()
@Controller('machines')
export class MachineAdministrationController {
  constructor(private readonly service: MachineAdministrationService) {}

  @Post(':id/maintenance')
  @Roles('RECEPCION_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registra el inicio de un mantenimiento' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: OpenMaintenanceResponseDto })
  @ApiConflictResponse({ description: 'Ya existe un mantenimiento abierto.' })
  @ApiNotFoundResponse({ description: 'Máquina no encontrada.' })
  openMaintenance(
    @Param() params: MachineIdParamsDto,
    @Body() dto: OpenMaintenanceDto,
    @CurrentUser() user: User,
  ): Promise<OpenMaintenanceResponseDto> {
    return this.service.openMaintenance(params.id, dto, user.id);
  }

  @Patch(':id/maintenance/:maintenanceId/complete')
  @Roles('RECEPCION_ADMIN')
  @ApiOperation({ summary: 'Cierra un período de mantenimiento' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'maintenanceId', format: 'uuid' })
  @ApiOkResponse({ type: CompleteMaintenanceResponseDto })
  @ApiConflictResponse({
    description:
      'El mantenimiento ya está cerrado o la transición no está permitida.',
  })
  @ApiNotFoundResponse({
    description: 'Máquina o mantenimiento no encontrado.',
  })
  completeMaintenance(
    @Param() params: CompleteMaintenanceParamsDto,
    @Body() dto: CompleteMaintenanceDto,
    @CurrentUser() user: User,
  ): Promise<CompleteMaintenanceResponseDto> {
    return this.service.completeMaintenance(
      params.id,
      params.maintenanceId,
      dto,
      user.id,
    );
  }

  @Patch(':id/status')
  @Roles('RECEPCION_ADMIN')
  @ApiOperation({ summary: 'Cambia manualmente el estado de una máquina' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ChangeMachineStatusResponseDto })
  @ApiConflictResponse({ description: 'La transición no está permitida.' })
  @ApiNotFoundResponse({ description: 'Máquina no encontrada.' })
  changeStatus(
    @Param() params: MachineIdParamsDto,
    @Body() dto: ChangeMachineStatusDto,
    @CurrentUser() user: User,
  ): Promise<ChangeMachineStatusResponseDto> {
    return this.service.changeMachineStatus(params.id, dto, user.id);
  }
}
