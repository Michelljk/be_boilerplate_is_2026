import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { UserRole, type User } from '@PrismaClient';
import { MembershipsService } from '../services/index.js';
import {
  MyMembershipResponseDto,
  PlanListResponseDto,
  PlanResponseDto,
  PlanWriteDto,
  PurchaseDto,
  PurchaseResponseDto,
  RenewalDto,
  RenewalResponseDto,
  UpdatePlanDto,
} from '../dto/index.js';

const ADMIN = UserRole.RECEPCION_ADMIN;
const MEMBER = UserRole.MIEMBRO;

/** H1 consulta propia, H2 compra/renovación y H3 catálogo de planes. */
@ApiTags('Membresías y planes')
@ApiBearerAuth()
@Controller()
export class MembershipsController {
  constructor(private readonly service: MembershipsService) {}

  @Get('memberships/me')
  @Roles(MEMBER)
  @ApiOkResponse({ type: MyMembershipResponseDto })
  @ApiUnauthorizedResponse({ description: 'Sin autenticación.' })
  @ApiForbiddenResponse({ description: 'Rol sin permiso.' })
  mine(@CurrentUser() user: User): Promise<MyMembershipResponseDto> {
    return this.service.mine(user.id);
  }

  @Get('membership-plans')
  @Roles(ADMIN)
  @ApiOkResponse({ type: PlanListResponseDto })
  @ApiBadRequestResponse({ description: 'Estado de plan inválido.' })
  @ApiForbiddenResponse({ description: 'Rol sin permiso.' })
  plans(@Query('status') status?: string): Promise<PlanListResponseDto> {
    return this.service.listPlans(status);
  }

  @Post('membership-plans')
  @Roles(ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: PlanResponseDto })
  @ApiBadRequestResponse({ description: 'Plan sin nombre, precio o duración.' })
  @ApiConflictResponse({ description: 'Duplicidad de nombre de plan.' })
  @ApiForbiddenResponse({ description: 'Rol sin permiso.' })
  createPlan(@Body() dto: PlanWriteDto): Promise<PlanResponseDto> {
    return this.service.createPlan(dto);
  }

  @Patch('membership-plans/:id')
  @Roles(ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PlanResponseDto })
  @ApiBadRequestResponse({ description: 'Identificador o datos inválidos.' })
  @ApiNotFoundResponse({ description: 'Plan inexistente.' })
  @ApiConflictResponse({ description: 'Duplicidad de nombre de plan.' })
  updatePlan(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdatePlanDto,
  ): Promise<PlanResponseDto> {
    return this.service.updatePlan(id, dto);
  }

  @Post('memberships/purchases')
  @Roles(ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: PurchaseResponseDto })
  @ApiBadRequestResponse({
    description: 'Datos obligatorios ausentes o UUID mal formado.',
  })
  @ApiNotFoundResponse({ description: 'Miembro o plan inexistente.' })
  @ApiConflictResponse({
    description: 'Plan indisponible o solicitud ya pendiente.',
  })
  purchase(
    @Body() dto: PurchaseDto,
    @CurrentUser() user: User,
  ): Promise<PurchaseResponseDto> {
    return this.service.request(
      dto.memberNumber,
      dto.planId,
      'COMPRA',
      user.id,
    ) as Promise<PurchaseResponseDto>;
  }

  @Post('memberships/:id/renewals')
  @Roles(ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: RenewalResponseDto })
  @ApiBadRequestResponse({ description: 'Identificador o datos inválidos.' })
  @ApiNotFoundResponse({ description: 'Membresía o plan inexistente.' })
  @ApiConflictResponse({ description: 'La membresía no permite renovación.' })
  renewal(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RenewalDto,
    @CurrentUser() user: User,
  ): Promise<RenewalResponseDto> {
    return this.service.requestByMembership(id, dto.planId, user.id);
  }
}
