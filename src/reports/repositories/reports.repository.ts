import { Injectable } from '@nestjs/common';
import { Prisma } from '@PrismaClient';
import { PrismaService } from '@Prisma/services';
import { serializable } from '@Common/repositories';
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
        WHERE (cs.starts_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/El_Salvador')::date BETWEEN ${from}::date AND ${to}::date
          AND cs.status <> 'CANCELADA'
        GROUP BY cs.class_template_id
      ),
      reservation_totals AS (
        SELECT cs.class_template_id, COUNT(cr.id)::int AS reservations
        FROM class_sessions cs
        JOIN class_reservations cr ON cr.session_id = cs.id
        WHERE (cs.starts_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/El_Salvador')::date BETWEEN ${from}::date AND ${to}::date
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
      Array<{ concept: string | null; totalUsd: string; isTotal: boolean }>
    >(Prisma.sql`
      WITH paid AS (
        SELECT concept, amount_usd
        FROM payments
        WHERE status = 'PAGADO'
          AND (paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/El_Salvador')::date BETWEEN ${from}::date AND ${to}::date
      ), grouped AS (
        SELECT concept::text AS concept,
          COALESCE(SUM(amount_usd), 0)::numeric(14,2)::text AS "totalUsd",
          false AS "isTotal"
        FROM paid
        GROUP BY concept
        UNION ALL
        SELECT NULL AS concept,
          COALESCE(SUM(amount_usd), 0)::numeric(14,2)::text AS "totalUsd",
          true AS "isTotal"
        FROM paid
      )
      SELECT concept, "totalUsd", "isTotal" FROM grouped
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
    return {
      from,
      to,
      totalUsd: rows.find((row) => row.isTotal)?.totalUsd ?? '0.00',
      byConcept,
    };
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
      ), valid_periods AS (
        SELECT mp.member_id, mp.starts_on, mp.ends_on, mp.payment_id
        FROM membership_periods mp
        JOIN payments p
          ON p.id = mp.payment_id
         AND p.member_id = mp.member_id
         AND p.status = 'PAGADO'
         AND p.concept = 'MEMBRESIA'
        UNION ALL
        SELECT mb.member_id, mb.starts_on, mb.ends_on, mb.payment_id
        FROM memberships mb
        JOIN payments p
          ON p.id = mb.payment_id
         AND p.member_id = mb.member_id
         AND p.status = 'PAGADO'
         AND p.concept = 'MEMBRESIA'
        WHERE NOT EXISTS (
          SELECT 1
          FROM membership_periods existing_period
          WHERE existing_period.membership_id = mb.id
        )
      ), expired_periods AS (
        SELECT m.month, vp.member_id, vp.ends_on
        FROM months m
        JOIN valid_periods vp
          ON vp.ends_on >= m.month
         AND vp.ends_on < (m.month + interval '1 month')::date
        WHERE vp.ends_on + 30 <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/El_Salvador')::date
      ), aggregates AS (
        SELECT e.month, COUNT(*)::int AS expired,
          COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1
            FROM valid_periods next_period
            WHERE next_period.member_id = e.member_id
              AND next_period.starts_on > e.ends_on
              AND next_period.starts_on <= e.ends_on + 30
          ))::int AS renewed
        FROM expired_periods e
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
    return serializable(this.prisma, async (tx) => {
      const completed = await tx.$queryRaw<
        Array<{ trainerId: string; completedSessions: number }>
      >(Prisma.sql`
        SELECT cs.trainer_id AS "trainerId", COUNT(*)::int AS "completedSessions"
        FROM class_sessions cs
        WHERE cs.status = 'COMPLETADA'::"SessionStatus"
          AND (cs.starts_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/El_Salvador')::date BETWEEN ${from}::date AND ${to}::date
        GROUP BY cs.trainer_id
      `);
      const ratings = await this.reviews.trainerAverages(tx, { from, to });
      const completedByTrainer = new Map(
        completed.map((row) => [row.trainerId, row.completedSessions]),
      );
      const records = ratings.map((row) => ({
        trainerId: row.trainerId,
        name: row.name,
        completedSessions: completedByTrainer.get(row.trainerId) ?? 0,
        averageRating: row.averageRating,
        ratingsCount: row.reviewCount,
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
    });
  }
}
