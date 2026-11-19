import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { Prisma, type CheckInMembershipStatus } from '@PrismaClient';

export interface HistoryRow {
  readonly id: string;
  readonly memberNumber: string;
  readonly memberName: string;
  readonly checkedInAt: Date;
  readonly membershipStatus: CheckInMembershipStatus;
  readonly expiredConfirmed: boolean;
}

export interface HistoryFilters {
  readonly from: Date;
  readonly to: Date;
  readonly memberNumber?: string;
  readonly skip: number;
  readonly take: number;
}

export interface HistorySnapshot {
  readonly rows: HistoryRow[];
  readonly total: number;
}

const ROW_FIELDS = {
  id: true,
  checkedInAt: true,
  membershipStatus: true,
  expiredConfirmed: true,
  member: {
    select: {
      email: true,
      memberProfile: { select: { memberNumber: true } },
      profile: { select: { fullName: true } },
    },
  },
} satisfies Prisma.CheckInSelect;

type HistoryPrismaRow = Prisma.CheckInGetPayload<{
  select: typeof ROW_FIELDS;
}>;

@Injectable()
export class CheckInHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pagina el historial filtrando por `check_in_date`, la fecha civil del
   * gimnasio (H15 · Datos), ordenada por fecha y hora descendentes. Las dos
   * consultas se ejecutan dentro de un snapshot RepeatableRead para que `data`
   * y `total` correspondan a la misma vista de la base.
   */
  async paginate(filters: HistoryFilters): Promise<HistorySnapshot> {
    return this.prisma.$transaction(
      async (tx) => {
        const where = this.buildWhere(filters);
        const [rows, total] = await Promise.all([
          tx.checkIn.findMany({
            where,
            select: ROW_FIELDS,
            orderBy: [{ checkedInAt: 'desc' }, { id: 'desc' }],
            skip: filters.skip,
            take: filters.take,
          }),
          tx.checkIn.count({ where }),
        ]);

        return { rows: rows.map(toRow), total };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private buildWhere(filters: HistoryFilters): Prisma.CheckInWhereInput {
    const byMember = filters.memberNumber
      ? { member: { memberProfile: { memberNumber: filters.memberNumber } } }
      : {};

    return {
      checkInDate: { gte: filters.from, lte: filters.to },
      ...byMember,
    };
  }
}

function toRow(row: HistoryPrismaRow): HistoryRow {
  return {
    id: row.id,
    memberNumber: row.member.memberProfile?.memberNumber ?? '',
    memberName: row.member.profile?.fullName ?? row.member.email,
    checkedInAt: row.checkedInAt,
    membershipStatus: row.membershipStatus,
    expiredConfirmed: row.expiredConfirmed,
  };
}
