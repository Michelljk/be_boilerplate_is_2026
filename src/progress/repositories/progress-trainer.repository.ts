import { Injectable } from '@nestjs/common';
import { DomainError } from '@Common/errors';
import { PrismaService } from '@Prisma/services';
import { AssignmentStatus, Prisma, UserRole } from '@PrismaClient';
import { MAX_SERIES_POINTS } from '../limits.js';
import { ProgressRecordRepository } from './progress-record.repository.js';
import type {
  CivilRange,
  MemberProgressView,
  TrainerMemberPage,
  TrainerMemberView,
} from '../progress-views.js';

/**
 * Lecturas del entrenador sobre sus clientes (H26).
 *
 * Toda consulta parte de `trainer_member_assignments` con estado `ACTIVA`: una
 * asignación finalizada, inexistente o de otro entrenador responde 404 sin
 * divulgar si el miembro existe ni cuántos registros tiene.
 */
@Injectable()
export class ProgressTrainerRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly records: ProgressRecordRepository,
  ) {}

  /** Directorio paginado de clientes activos asignados al entrenador. */
  async members(
    trainerId: string,
    search: string,
    page: number,
    pageSize: number,
  ): Promise<TrainerMemberPage> {
    const where: Prisma.TrainerMemberAssignmentWhereInput = {
      trainerId,
      status: AssignmentStatus.ACTIVA,
      member: {
        role: UserRole.MIEMBRO,
        isActive: true,
        ...(search
          ? {
              OR: [
                {
                  profile: {
                    fullName: { contains: search, mode: 'insensitive' },
                  },
                },
                {
                  memberProfile: {
                    memberNumber: { contains: search, mode: 'insensitive' },
                  },
                },
              ],
            }
          : {}),
      },
    };

    const [rows, total] = await Promise.all([
      this.prisma.trainerMemberAssignment.findMany({
        where,
        select: {
          member: {
            select: {
              id: true,
              email: true,
              memberProfile: { select: { memberNumber: true } },
              profile: { select: { fullName: true } },
            },
          },
        },
        orderBy: [
          { member: { profile: { fullName: 'asc' } } },
          { member: { email: 'asc' } },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.trainerMemberAssignment.count({ where }),
    ]);

    return {
      rows: rows.map<TrainerMemberView>(({ member }) => ({
        memberId: member.id,
        memberNumber: member.memberProfile?.memberNumber ?? null,
        memberName:
          member.profile?.fullName ??
          member.memberProfile?.memberNumber ??
          member.email,
      })),
      total,
      page,
      pageSize,
    };
  }

  /** Ficha de cliente: registros del rango y resumen de peso (H26). */
  async memberProgress(
    trainerId: string,
    memberId: string,
    filter: CivilRange,
  ): Promise<MemberProgressView> {
    const assigned = await this.prisma.trainerMemberAssignment.findFirst({
      where: {
        trainerId,
        memberId,
        status: AssignmentStatus.ACTIVA,
        member: { role: UserRole.MIEMBRO, isActive: true },
      },
      select: { id: true },
    });
    if (!assigned) {
      throw new DomainError('NOT_FOUND', 'Recurso no encontrado.');
    }

    const [rows, weight] = await Promise.all([
      this.records.recordsInRange(memberId, filter),
      this.records.evolution(
        memberId,
        'weightKg',
        undefined,
        filter.from,
        filter.to,
      ),
    ]);

    return {
      memberId,
      records: rows.slice(0, MAX_SERIES_POINTS).map((row) => ({
        date: row.recordDate,
        weightKg: row.weightKg,
        waistCm: row.waistCm,
        chestCm: row.chestCm,
        armCm: row.armCm,
        marks: row.marks,
      })),
      evolution: {
        baseline: weight.baseline,
        latest: weight.latest,
        difference: weight.difference,
      },
    };
  }
}
