import { Injectable } from '@nestjs/common';
import { GymClock, addDays, isCalendarDate } from '@Common/time';
import { DomainError } from '@Common/errors';
import { AttendanceStatus, UserRole, type User } from '@PrismaClient';
import {
  AgendaView,
  AttendanceChoice,
  type AgendaItemDto,
  type AgendaQueryDto,
  type AgendaResponseDto,
  type AttendanceResponseDto,
  type RegisterAttendanceDto,
} from '../dto/agenda.dto.js';
import { TrainerAgendaRepository } from '../repositories/trainer-agenda.repository.js';

const ATTENDANCE_ALREADY_REGISTERED =
  'La sesión ya tiene asistencia registrada';

@Injectable()
export class TrainerAgendaService {
  constructor(
    private readonly repository: TrainerAgendaRepository,
    private readonly clock: GymClock,
  ) {}

  async getAgenda(
    user: User,
    query: AgendaQueryDto,
  ): Promise<AgendaResponseDto> {
    this.assertTrainer(user);
    this.assertAgendaQuery(query);

    const fromDate = this.agendaStartDate(query.view, query.date);
    const toDate = addDays(fromDate, query.view === AgendaView.DAY ? 1 : 7);
    const snapshot = await this.repository.findAgendaByTrainerAndRange(
      user.id,
      this.localMidnight(fromDate),
      this.localMidnight(toDate),
    );

    return {
      data: snapshot.items.map((item): AgendaItemDto => {
        if (!item.member.profile || !item.member.memberProfile) {
          throw new DomainError(
            'INVALID',
            'Los datos del miembro están incompletos.',
          );
        }
        return {
          id: item.id,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          memberNumber: item.member.memberProfile.memberNumber,
          memberName: item.member.profile.fullName,
          status: item.status,
          attendance: item.attendance,
        };
      }),
    };
  }

  async registerAttendance(
    user: User,
    id: string,
    dto: RegisterAttendanceDto,
  ): Promise<AttendanceResponseDto> {
    this.assertTrainer(user);
    if (!this.isUuid(id)) {
      throw new DomainError(
        'INVALID',
        'El id de la sesión debe ser un UUID válido.',
      );
    }
    if (!dto || !this.isAttendanceChoice(dto.attendance)) {
      throw new DomainError(
        'INVALID',
        'attendance debe ser ASISTIO o NO_ASISTIO.',
      );
    }

    const result = await this.repository.completeAttendance(
      id,
      user.id,
      dto.attendance,
      this.clock.now(),
    );

    if (
      result.status !== 'COMPLETADA' ||
      (result.attendance !== AttendanceStatus.ASISTIO &&
        result.attendance !== AttendanceStatus.NO_ASISTIO) ||
      !result.completedAt
    ) {
      throw new DomainError('CONFLICT', ATTENDANCE_ALREADY_REGISTERED);
    }

    return {
      id: result.id,
      status: 'COMPLETADA',
      attendance: dto.attendance,
      completedAt: result.completedAt,
    };
  }

  private assertTrainer(user: User): void {
    if (user.role !== UserRole.ENTRENADOR) {
      throw new DomainError('FORBIDDEN', 'Acceso denegado.');
    }
  }

  private assertAgendaQuery(query: AgendaQueryDto): void {
    if (!query || !Object.values(AgendaView).includes(query.view)) {
      throw new DomainError('INVALID', 'view debe ser day o week.');
    }
    if (!query.date || !isCalendarDate(query.date)) {
      throw new DomainError(
        'INVALID',
        'date debe ser una fecha civil válida con formato YYYY-MM-DD.',
      );
    }
  }

  private agendaStartDate(view: AgendaView, date: string): string {
    if (view === AgendaView.DAY) return date;
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    return addDays(date, -((weekday + 6) % 7));
  }

  private localMidnight(date: string): Date {
    return new Date(`${date}T00:00:00-06:00`);
  }

  private isAttendanceChoice(value: unknown): value is AttendanceChoice {
    return (
      value === AttendanceChoice.ASISTIO ||
      value === AttendanceChoice.NO_ASISTIO
    );
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
