import { Injectable } from '@nestjs/common';
import { Prisma } from '@PrismaClient';
import { PrismaService } from '@Prisma/services';
import { sortOccupancy, occupancyLabel } from '../reports-math.js';
import { ReviewsRepository } from '../../reviews/repositories/reviews.repository.js';

@Injectable()
export class ReportsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsRepository,
  ) {}

  async occupancy(from: string, to: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        classId: string;
        name: string;
        totalCapacity: number;
        confirmedReservations: number;
        occupancyPct: number;
      }>
    >(Prisma.sql`
      WITH session_totals AS (
        SELECT cs.class_template_id, SUM(cs.capacity)::int AS capacity
        FROM class_sessions cs
        WHERE (cs.starts_at AT TIME ZONE 'America/El_Salvador')::date BETWEEN ${from}::date AND ${to}::date
          AND cs.status <> 'CANCELADA'
        GROUP BY cs.class_template_id
      ),
      reservation_totals AS (
        SELECT cs.class_template_id, COUNT(cr.id)::int AS reservations
        FROM class_sessions cs
        JOIN class_reservations cr ON cr.session_id = cs.id
        WHERE (cs.starts_at AT TIME ZONE 'America/El_Salvador')::date BETWEEN ${from}::date AND ${to}::date
          AND cs.status <> 'CANCELADA'
          AND cr.status = 'CONFIRMADA'
        GROUP BY cs.class_template_id
      )
      SELECT ct.id AS "classId", ct.name AS name,
        st.capacity AS "totalCapacity",
        COALESCE(rt.reservations, 0)::int AS "confirmedReservations",
        CASE WHEN st.capacity = 0 THEN 0
          ELSE ROUND(COALESCE(rt.reservations, 0)::numeric * 100 / st.capacity, 1)::float8
        END AS "occupancyPct"
      FROM session_totals st
      JOIN class_templates ct ON ct.id = st.class_template_id
      LEFT JOIN reservation_totals rt ON rt.class_template_id = st.class_template_id
    `);
    const ordered = sortOccupancy(rows);
    return {
      from,
      to,
      data: ordered.map((row, index) => ({
        ...row,
        label: occupancyLabel(index, ordered.length),
      })),
    };
  }

  async income(from: string, to: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{ concept: string; totalUsd: string }>
    >(Prisma.sql`
      SELECT concept::text AS concept, COALESCE(SUM(amount_usd), 0)::numeric(14,2)::text AS "totalUsd"
      FROM payments
      WHERE status = 'PAGADO'
        AND (paid_at AT TIME ZONE 'America/El_Salvador')::date BETWEEN ${from}::date AND ${to}::date
      GROUP BY concept
    `);
    const concepts = [
      'MEMBRESIA',
      'SESION_PERSONAL',
      'SESION_ADICIONAL',
    ] as const;
    const byConcept = concepts.map((concept) => ({
      concept,
      totalUsd: rows.find((row) => row.concept === concept)?.totalUsd ?? '0.00',
    }));
    const total = await this.prisma.$queryRaw<
      Array<{ totalUsd: string }>
    >(Prisma.sql`
      SELECT COALESCE(SUM(amount_usd), 0)::numeric(14,2)::text AS "totalUsd"
      FROM payments
      WHERE status = 'PAGADO'
        AND (paid_at AT TIME ZONE 'America/El_Salvador')::date BETWEEN ${from}::date AND ${to}::date
    `);
    return { from, to, totalUsd: total[0]?.totalUsd ?? '0.00', byConcept };
  }

  async retention(from: string, to: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        month: string;
        expired: number;
        renewed: number;
        cancelled: number;
      }>
    >(Prisma.sql`
      WITH months AS (
        SELECT generate_series(${`${from}-01`}::date, ${`${to}-01`}::date, interval '1 month')::date AS month
      ), expired_memberships AS (
        SELECT m.month, mb.id, mb.member_id, mb.ends_on
        FROM months m
        JOIN memberships mb ON date_trunc('month', mb.ends_on)::date = m.month
        JOIN payments p ON p.id = mb.payment_id AND p.status = 'PAGADO'
        WHERE mb.ends_on + 30 <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/El_Salvador')::date
      ), aggregates AS (
        SELECT e.month, COUNT(*)::int AS expired,
          COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM memberships next_membership
            JOIN payments next_payment ON next_payment.id = next_membership.payment_id
              AND next_payment.status = 'PAGADO'
            WHERE next_membership.member_id = e.member_id
              AND next_membership.starts_on > e.ends_on
              AND next_membership.starts_on <= e.ends_on + 30
          ))::int AS renewed
        FROM expired_memberships e
        GROUP BY e.month
      )
      SELECT to_char(m.month, 'YYYY-MM') AS month,
        COALESCE(a.expired, 0)::int AS expired,
        COALESCE(a.renewed, 0)::int AS renewed,
        (COALESCE(a.expired, 0) - COALESCE(a.renewed, 0))::int AS cancelled
      FROM months m LEFT JOIN aggregates a USING (month)
      ORDER BY m.month
    `);
    return {
      months: rows.map((row) => ({
        ...row,
        renewalRate: row.expired
          ? ((row.renewed * 100) / row.expired).toFixed(2)
          : null,
        cancellationRate: row.expired
          ? ((row.cancelled * 100) / row.expired).toFixed(2)
          : null,
      })),
    };
  }

  async trainerPerformance(
    from: string,
    to: string,
    sortBy: 'rating' | 'sessions',
    order: 'asc' | 'desc',
  ) {
    const completed = await this.prisma.$queryRaw<
      Array<{ trainerId: string; completedSessions: number }>
    >(Prisma.sql`
      SELECT cs.trainer_id AS "trainerId", COUNT(*)::int AS "completedSessions"
      FROM class_sessions cs
      WHERE cs.status = 'COMPLETADA'
        AND (cs.starts_at AT TIME ZONE 'America/El_Salvador')::date BETWEEN ${from}::date AND ${to}::date
      GROUP BY cs.trainer_id
    `);
    const averages = await this.reviews.trainerAverages();
    const records = averages.map((average) => ({
      trainerId: average.trainerId,
      name: average.name,
      completedSessions:
        completed.find((item) => item.trainerId === average.trainerId)
          ?.completedSessions ?? 0,
      averageRating: average.averageRating,
      ratingsCount: average.reviewCount,
    }));
    records.sort((a, b) => {
      const primaryA =
        sortBy === 'rating' ? a.averageRating : a.completedSessions;
      const primaryB =
        sortBy === 'rating' ? b.averageRating : b.completedSessions;
      let comparison = 0;
      if (primaryA === null) comparison = primaryB === null ? 0 : 1;
      else if (primaryB === null) comparison = -1;
      else {
        comparison = primaryA - primaryB;
        if (order === 'desc') comparison = -comparison;
      }
      return (
        comparison ||
        b.completedSessions - a.completedSessions ||
        a.name.localeCompare(b.name)
      );
    });
    return { data: records };
  }
}
