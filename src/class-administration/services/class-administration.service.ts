import { Injectable } from '@nestjs/common';
import {
  ClassStatus,
  SessionStatus,
  UserRole,
  type ClassTemplate,
  type Room,
} from '@PrismaClient';
import { DomainError } from '@Common/errors';
import { GymClock, addDays, isCalendarDate } from '@Common/time';
import {
  ClassAdministrationRepository,
  type CancellationResult,
  type GenerationResult,
  type SessionWithDuration,
  type TemplateWriteData,
  type TrainerRecord,
} from '../repositories/index.js';
import type {
  CancelClassSessionDto,
  CreateClassTemplateDto,
  GenerateClassSessionsDto,
  UpdateClassSessionDto,
  UpdateClassTemplateDto,
} from '../dto/index.js';

const ALLOWED_DURATIONS = new Set<number>([30, 45, 60, 75, 90, 120]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const ISO_WITH_ZONE_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/i;
const CREATE_TEMPLATE_KEYS = [
  'name',
  'trainerId',
  'roomId',
  'weekday',
  'startTime',
  'durationMinutes',
  'capacity',
] as const;
const UPDATE_TEMPLATE_KEYS = CREATE_TEMPLATE_KEYS;
const GENERATE_KEYS = ['fromDate', 'toDate'] as const;
const UPDATE_SESSION_KEYS = [
  'startsAt',
  'capacity',
  'roomId',
  'trainerId',
] as const;
const CANCEL_KEYS = ['reason'] as const;

@Injectable()
export class ClassAdministrationService {
  constructor(
    private readonly repository: ClassAdministrationRepository,
    private readonly clock: GymClock,
  ) {}

  async createTemplate(dto: CreateClassTemplateDto): Promise<ClassTemplate> {
    if (!dto) throw new DomainError('INVALID', 'El body es obligatorio.');
    this.assertInputShape(dto, CREATE_TEMPLATE_KEYS);
    const data = this.validateTemplateData(dto);
    this.validateTemplateInterval(data.startTime, data.durationMinutes);
    await this.assertTrainerAndRoom(data.trainerId, data.roomId, data.capacity);
    return this.repository.createTemplate(data);
  }

  async updateTemplate(
    id: string,
    dto: UpdateClassTemplateDto,
  ): Promise<ClassTemplate> {
    this.assertUuid(id, 'La plantilla no existe.');
    if (dto) this.assertInputShape(dto, UPDATE_TEMPLATE_KEYS);
    const current = await this.repository.findTemplateById(id);
    if (!current) throw new DomainError('NOT_FOUND', 'La plantilla no existe.');
    if (!dto || Object.keys(dto).length === 0) {
      throw new DomainError(
        'INVALID',
        'Debe enviar al menos un campo para actualizar.',
      );
    }

    const data: TemplateWriteData = {
      name: dto.name ?? current.name,
      trainerId: dto.trainerId ?? current.trainerId,
      roomId: dto.roomId ?? current.roomId,
      weekday: dto.weekday ?? current.weekday,
      startTime: dto.startTime ?? current.startTime,
      durationMinutes: dto.durationMinutes ?? current.durationMinutes,
      capacity: dto.capacity ?? current.capacity,
    };
    this.validateTemplateData(data);
    this.validateTemplateInterval(data.startTime, data.durationMinutes);
    await this.assertTrainerAndRoom(data.trainerId, data.roomId, data.capacity);
    return this.repository.updateTemplate(id, data, this.clock.now());
  }

  async generateSessions(
    id: string,
    dto: GenerateClassSessionsDto,
  ): Promise<GenerationResult> {
    this.assertUuid(id, 'La plantilla no existe.');
    if (!dto) throw new DomainError('INVALID', 'El body es obligatorio.');
    this.assertInputShape(dto, GENERATE_KEYS);
    if (!isCalendarDate(dto?.fromDate) || !isCalendarDate(dto?.toDate)) {
      throw new DomainError(
        'INVALID',
        'Las fechas deben ser fechas calendario válidas.',
      );
    }
    const from = dto.fromDate;
    const to = dto.toDate;
    const distance = this.daysBetween(from, to);
    if (distance < 0 || distance > 27) {
      throw new DomainError(
        'INVALID',
        'El intervalo debe contener entre 1 y 28 días.',
      );
    }

    const template = await this.repository.findTemplateById(id);
    if (!template)
      throw new DomainError('NOT_FOUND', 'La plantilla no existe.');
    if (template.status !== ClassStatus.ACTIVA) {
      throw new DomainError('CONFLICT', 'La plantilla está inactiva.');
    }
    this.validateTemplateInterval(template.startTime, template.durationMinutes);
    const candidates = [];
    for (let offset = 0; offset <= distance; offset += 1) {
      const date = addDays(from, offset);
      if (this.weekdayOf(date) !== template.weekday) continue;
      const startsAt = this.localInstant(date, template.startTime);
      const endsAt = new Date(
        startsAt.getTime() + template.durationMinutes * 60_000,
      );
      candidates.push({
        startsAt,
        endsAt,
        capacity: template.capacity,
        roomId: template.roomId,
        trainerId: template.trainerId,
      });
    }
    return this.repository.generateSessions(id, candidates);
  }

  async updateSession(
    id: string,
    dto: UpdateClassSessionDto,
  ): Promise<SessionWithDuration> {
    this.assertUuid(id, 'La sesión no existe.');
    if (dto) this.assertInputShape(dto, UPDATE_SESSION_KEYS);
    const current = await this.repository.findSessionById(id);
    if (!current) throw new DomainError('NOT_FOUND', 'La sesión no existe.');
    if (
      current.status !== SessionStatus.PROGRAMADA ||
      current.startsAt <= this.clock.now()
    ) {
      throw new DomainError('CONFLICT', 'No se puede editar esta sesión.');
    }
    if (!dto || Object.keys(dto).length === 0) {
      throw new DomainError(
        'INVALID',
        'Debe enviar al menos un campo para actualizar.',
      );
    }

    const startsAt =
      dto.startsAt === undefined
        ? current.startsAt
        : this.parseInstant(dto.startsAt);
    const roomId = dto.roomId ?? current.roomId;
    const trainerId = dto.trainerId ?? current.trainerId;
    const capacity = dto.capacity ?? current.capacity;
    const endsAt = new Date(
      startsAt.getTime() + current.classTemplate.durationMinutes * 60_000,
    );
    if (this.clock.dateOf(startsAt) !== this.clock.dateOf(endsAt)) {
      throw new DomainError(
        'INVALID',
        'La sesión no puede terminar en otro día.',
      );
    }
    if (startsAt <= this.clock.now()) {
      throw new DomainError('INVALID', 'La sesión debe ser futura.');
    }
    this.validateCapacity(capacity);

    const room = await this.repository.findRoomById(roomId);
    if (!room) throw new DomainError('NOT_FOUND', 'La sala no existe.');
    if (capacity > room.capacity) {
      throw new DomainError(
        'CONFLICT',
        'El cupo supera la capacidad de la sala.',
      );
    }
    const trainer = await this.repository.findTrainerById(trainerId);
    this.assertTrainer(trainer);
    const confirmed = await this.repository.countConfirmedReservations(id);
    if (capacity < confirmed) {
      throw new DomainError(
        'CONFLICT',
        'El cupo es menor a las reservas confirmadas',
      );
    }

    return this.repository.updateSession(id, {
      startsAt,
      endsAt,
      capacity,
      roomId,
      trainerId,
    });
  }

  async cancelSession(
    id: string,
    dto: CancelClassSessionDto,
    userId: string,
  ): Promise<CancellationResult> {
    this.assertUuid(id, 'La sesión no existe.');
    this.assertUuid(userId, 'El usuario autenticado no es válido.');
    if (!dto) throw new DomainError('INVALID', 'El body es obligatorio.');
    this.assertInputShape(dto, CANCEL_KEYS);
    const reason = dto?.reason;
    if (
      reason !== undefined &&
      (typeof reason !== 'string' || reason.length > 250)
    ) {
      throw new DomainError(
        'INVALID',
        'El motivo no puede superar 250 caracteres.',
      );
    }
    const session = await this.repository.findSessionById(id);
    if (!session) throw new DomainError('NOT_FOUND', 'La sesión no existe.');
    if (session.status !== SessionStatus.PROGRAMADA) {
      throw new DomainError('CONFLICT', 'No se puede cancelar esta sesión');
    }
    return this.repository.cancelSession(
      id,
      reason ?? null,
      userId,
      this.clock.now(),
    );
  }

  listRooms(): Promise<Room[]> {
    return this.repository.listRooms();
  }

  listTrainers(): Promise<TrainerRecord[]> {
    return this.repository.listTrainers();
  }

  private validateTemplateData(data: TemplateWriteData): TemplateWriteData {
    if (
      typeof data.name !== 'string' ||
      data.name.length < 3 ||
      data.name.length > 80 ||
      data.name.trim().length < 3
    ) {
      throw new DomainError(
        'INVALID',
        'El nombre debe tener entre 3 y 80 caracteres.',
      );
    }
    this.assertUuid(data.trainerId, 'El entrenador no es válido.');
    this.assertUuid(data.roomId, 'La sala no es válida.');
    if (
      !Number.isInteger(data.weekday) ||
      data.weekday < 1 ||
      data.weekday > 7
    ) {
      throw new DomainError(
        'INVALID',
        'El día de la semana debe estar entre 1 y 7.',
      );
    }
    if (
      typeof data.startTime !== 'string' ||
      !TIME_PATTERN.test(data.startTime)
    ) {
      throw new DomainError('INVALID', 'La hora debe tener formato HH:mm.');
    }
    if (
      !Number.isInteger(data.durationMinutes) ||
      !ALLOWED_DURATIONS.has(data.durationMinutes)
    ) {
      throw new DomainError('INVALID', 'La duración no es válida.');
    }
    this.validateCapacity(data.capacity);
    return data;
  }

  private validateTemplateInterval(
    startTime: string,
    durationMinutes: number,
  ): void {
    const [hours, minutes] = startTime.split(':').map(Number);
    if (hours * 60 + minutes + durationMinutes >= 24 * 60) {
      throw new DomainError(
        'INVALID',
        'La clase no puede terminar en otro día.',
      );
    }
  }

  private validateCapacity(value: number): void {
    if (!Number.isInteger(value) || value < 1 || value > 50) {
      throw new DomainError('INVALID', 'El cupo debe estar entre 1 y 50.');
    }
  }

  private async assertTrainerAndRoom(
    trainerId: string,
    roomId: string,
    capacity: number,
  ): Promise<void> {
    const trainer = await this.repository.findTrainerById(trainerId);
    this.assertTrainer(trainer);
    const room = await this.repository.findRoomById(roomId);
    if (!room) throw new DomainError('NOT_FOUND', 'La sala no existe.');
    if (capacity > room.capacity) {
      throw new DomainError(
        'CONFLICT',
        'El cupo supera la capacidad de la sala.',
      );
    }
  }

  private assertTrainer(
    trainer: TrainerRecord | null,
  ): asserts trainer is TrainerRecord {
    if (!trainer || trainer.role !== UserRole.ENTRENADOR || !trainer.isActive) {
      throw new DomainError('NOT_FOUND', 'El entrenador no existe.');
    }
  }

  private assertUuid(value: string, message: string): void {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
      throw new DomainError('INVALID', message);
    }
  }

  private assertInputShape(
    value: object,
    allowedKeys: readonly string[],
  ): void {
    for (const [key, field] of Object.entries(value)) {
      if (!allowedKeys.includes(key)) {
        throw new DomainError(
          'INVALID',
          `La propiedad ${key} no está permitida.`,
        );
      }
      if (field === null) {
        throw new DomainError(
          'INVALID',
          `La propiedad ${key} no puede ser null.`,
        );
      }
    }
  }

  private parseInstant(value: string): Date {
    if (typeof value !== 'string' || !ISO_WITH_ZONE_PATTERN.test(value)) {
      throw new DomainError('INVALID', 'La fecha y hora no son válidas.');
    }
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) {
      throw new DomainError('INVALID', 'La fecha y hora no son válidas.');
    }
    return parsed;
  }

  private localInstant(date: string, time: string): Date {
    return new Date(`${date}T${time}:00-06:00`);
  }

  private weekdayOf(date: string): number {
    const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    return day === 0 ? 7 : day;
  }

  private daysBetween(from: string, to: string): number {
    return Math.floor(
      (new Date(`${to}T00:00:00.000Z`).getTime() -
        new Date(`${from}T00:00:00.000Z`).getTime()) /
        86_400_000,
    );
  }
}
