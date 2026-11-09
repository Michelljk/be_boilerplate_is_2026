import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { Prisma } from '@PrismaClient';
@Injectable()
export class TrainingCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}
  assignedMembers(trainerId: string) {
    return this.prisma.trainerMemberAssignment.findMany({
      where: {
        trainerId,
        status: 'ACTIVA',
        member: { isActive: true, role: 'MIEMBRO' },
      },
      select: {
        member: {
          select: {
            id: true,
            profile: { select: { fullName: true } },
            memberProfile: { select: { memberNumber: true } },
          },
        },
      },
      orderBy: { memberId: 'asc' },
    });
  }
  exercises(page: number, pageSize: number) {
    return this.prisma.$transaction(
      async (tx) => {
        const where = { isActive: true };
        const [data, total] = await Promise.all([
          tx.exercise.findMany({
            where,
            select: { id: true, name: true, muscleGroup: true },
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          tx.exercise.count({ where }),
        ]);
        return { data, total, page, pageSize };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
