import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { UserRole, type User } from '@PrismaClient';
import {
  CreateTrainerSlotDto,
  ListTrainerSlotsQueryDto,
  TrainerSlotListResponseDto,
  TrainerSlotResponseDto,
  UpdateTrainerSlotDto,
} from '../dto/index.js';
import { TrainerSlotsService } from '../services/index.js';

@ApiTags('trainer-slots')
@ApiBearerAuth()
@Roles(UserRole.ENTRENADOR)
@Controller('trainer-slots')
export class TrainerSlotsController {
  constructor(private readonly trainerSlotsService: TrainerSlotsService) {}

  @Post()
  @ApiOperation({ summary: 'Define un espacio disponible de 60 minutos' })
  @ApiCreatedResponse({ type: TrainerSlotResponseDto })
  @ApiConflictResponse({ description: 'Ya tienes un espacio en ese horario' })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateTrainerSlotDto,
  ): Promise<TrainerSlotResponseDto> {
    const slot = await this.trainerSlotsService.create(user, dto);
    return TrainerSlotResponseDto.fromEntity(slot);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Lista la disponibilidad del entrenador autenticado',
  })
  @ApiOkResponse({ type: TrainerSlotListResponseDto })
  async list(
    @CurrentUser() user: User,
    @Query() query: ListTrainerSlotsQueryDto,
  ): Promise<TrainerSlotListResponseDto> {
    const slots = await this.trainerSlotsService.list(user, query);
    return TrainerSlotListResponseDto.fromEntities(slots);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita un espacio propio que todavía está libre' })
  @ApiOkResponse({ type: TrainerSlotResponseDto })
  @ApiConflictResponse({
    description: 'Duplicidad o espacio con sesión confirmada',
  })
  @ApiNotFoundResponse({
    description: 'Espacio inexistente o perteneciente a otro entrenador',
  })
  async update(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateTrainerSlotDto,
  ): Promise<TrainerSlotResponseDto> {
    const slot = await this.trainerSlotsService.update(user, id, dto);
    return TrainerSlotResponseDto.fromEntity(slot);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina un espacio propio que está libre' })
  @ApiNoContentResponse({ description: 'Espacio eliminado sin cuerpo' })
  @ApiConflictResponse({
    description: 'El espacio tiene una sesión confirmada o histórica',
  })
  @ApiNotFoundResponse({
    description: 'Espacio inexistente o perteneciente a otro entrenador',
  })
  async remove(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.trainerSlotsService.remove(user, id);
  }
}
