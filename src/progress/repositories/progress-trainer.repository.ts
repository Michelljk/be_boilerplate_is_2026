
import { Injectable } from '@nestjs/common';
import { DomainError } from '@Common/errors';
import { PrismaService } from '@Prisma/services';
import {
  AssignmentStatus,
  Prisma,
  UserRole,
} from '@PrismaClient';

import type {
  MemberProgressView,
  TrainerMemberPage,
  TrainerMemberView,
} from '../dto/trainer-progress-response.dto.js';

const MAX_RECORDS = 366;

/**
 * H26 — Consulta de miembros asignados
 * y de su progreso físico.
 */
@Injectable()
export class ProgressTrainerRepository {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Consulta los miembros con asignación ACTIVA.
   */
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
                    fullName: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  memberProfile: {
                    memberNumber: {
                      contains: search,
                      mode: 'insensitive',
                    },
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
              memberProfile: {
                select: { memberNumber: true },
              },
              profile: {
                select: { fullName: true },
              },
            },
          },
        },
        orderBy: [
          {
            member: {
              profile: {
                fullName: 'asc',
              },
            },
          },
          { memberId: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),

      this.prisma.trainerMemberAssignment.count({
        where,
      }),
    ]);

    const members: TrainerMemberView[] = rows.map(
      ({ member }) => ({
        memberId: member.id,
        memberNumber:
          member.memberProfile?.memberNumber ?? null,
        memberName:
          member.profile?.fullName ??
          member.memberProfile?.memberNumber ??
          member.email,
      }),
    );

    return {
      rows: members,
      total,
      page,
      pageSize,
    };
  }

  /**
   * Consulta el progreso de un miembro.
   * Primero verifica que la asignación esté ACTIVA.
   */
  async memberProgress(
    trainerId: string,
    memberId: string,
  ): Promise<MemberProgressView> {
    const assignment =
      await this.prisma.trainerMemberAssignment.findFirst({
        where: {
          trainerId,
          memberId,
          status: AssignmentStatus.ACTIVA,
          member: {
            role: UserRole.MIEMBRO,
            isActive: true,
          },
        },
        select: { id: true },
      });

    if (!assignment) {
      throw new DomainError(
        'NOT_FOUND',
        'Recurso no encontrado.',
      );
    }

    const records =
      await this.prisma.progressRecord.findMany({
        where: { memberId },
        select: {
          recordDate: true,
          weightKg: true,
          waistCm: true,
          chestCm: true,
          armCm: true,
          marks: {
            select: {
              exerciseId: true,
              weightKg: true,
              reps: true,
            },
          },
        },
        orderBy: [
          { recordDate: 'desc' },
          { id: 'asc' },
        ],
        take: MAX_RECORDS,
      });

    const chronological = [...records].reverse();

    const first = chronological[0];
    const last = chronological[chronological.length - 1];

    const baseline = first
      ? Number(first.weightKg)
      : null;

    const latest = last
      ? Number(last.weightKg)
      : null;

    const difference =
      chronological.length >= 2 &&
      baseline !== null &&
      latest !== null
        ? Number((latest - baseline).toFixed(2))
        : null;

    return {
      memberId,
      records: chronological.map((record) => ({
        date: record.recordDate
          .toISOString()
          .slice(0, 10),
        weightKg: Number(record.weightKg),
        waistCm:
          record.waistCm === null
            ? null
            : Number(record.waistCm),
        chestCm:
          record.chestCm === null
            ? null
            : Number(record.chestCm),
        armCm:
          record.armCm === null
            ? null
            : Number(record.armCm),
        marks: record.marks.map((mark) => ({
          exerciseId: mark.exerciseId,
          weightKg: Number(mark.weightKg),
          reps: mark.reps,
        })),
      })),
      evolution: {
        baseline,
        latest,
        difference,
      },
    };
  }
}
