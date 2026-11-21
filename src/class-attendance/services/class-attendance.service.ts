import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { UserRole, type User } from '@PrismaClient';
import { DomainError } from '@Common/errors';
import { GymClock } from '@Common/time';
import type {
  AttendeesQueryDto,
  UpdateAttendanceDto,
} from '../dto/class-attendance.dto.js';
import { ClassAttendanceRepository } from '../repositories/class-attendance.repository.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class ClassAttendanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClassAttendanceService.name);
  private timer?: ReturnType<typeof setInterval>;
  constructor(
    private readonly repository: ClassAttendanceRepository,
    private readonly clock: GymClock,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.repository
        .advanceDueSessions(this.clock.now())
        .catch((error: unknown) => {
          this.logger.error(
            'No se pudieron avanzar las sesiones programadas.',
            error,
          );
        });
    }, 15_000);
    this.timer.unref?.();
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
  attendees(user: User, sessionId: string, query: AttendeesQueryDto) {
    this.assertTrainer(user);
    this.assertUuid(sessionId);
    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 10;
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      throw new DomainError('INVALID', 'Parámetros de paginación inválidos.');
    }
    return this.repository.attendees(
      sessionId,
      user.id,
      page,
      pageSize,
      this.clock.now(),
    );
  }

  updateAttendance(
    user: User,
    reservationId: string,
    dto: UpdateAttendanceDto,
  ) {
    this.assertTrainer(user);
    this.assertUuid(reservationId);
    if (
      !dto ||
      (dto.attendance !== 'ASISTIO' && dto.attendance !== 'NO_ASISTIO')
    ) {
      throw new DomainError(
        'INVALID',
        'La asistencia debe ser ASISTIO o NO_ASISTIO.',
      );
    }
    return this.repository.updateAttendance(
      reservationId,
      user.id,
      dto.attendance,
      this.clock.now(),
    );
  }

  complete(user: User, sessionId: string) {
    this.assertTrainer(user);
    this.assertUuid(sessionId);
    return this.repository.complete(sessionId, user.id, this.clock.now());
  }

  private assertTrainer(user: User): void {
    if (!user || user.role !== UserRole.ENTRENADOR) {
      throw new DomainError(
        'FORBIDDEN',
        'Solo el entrenador asignado puede gestionar la asistencia.',
      );
    }
  }

  private assertUuid(value: string): void {
    if (!UUID_PATTERN.test(value))
      throw new DomainError(
        'INVALID',
        'El identificador debe ser UUID válido.',
      );
  }
}
