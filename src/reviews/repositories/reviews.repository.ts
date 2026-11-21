import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { Prisma, SessionStatus, AttendanceStatus } from '@PrismaClient';
import { DomainError } from '@Common/errors';
import { serializable } from '@Common/repositories';
import { REVIEW_MESSAGES } from '../reviews.errors.js';

/**
 * Lo que el repositorio encontró en la base de datos al intentar calificar.
 * El repositorio no decide códigos HTTP: reporta el hecho y el servicio
 * traduce (404 para sesión inexistente o ajena, 409 para el resto).
 */
export type ReviewGate =
  | 'OPEN'
  | 'SESSION_NOT_VISIBLE'
  | 'SESSION_NOT_COMPLETED'
  | 'ATTENDANCE_MISSING'
  | 'DUPLICATE';

export type ReviewCreationResult =
  | { kind: 'CREATED'; review: ReviewRecord }
  | { kind: Exclude<ReviewGate, 'OPEN'> };

export interface ReviewRecord {
  id: string;
  sessionId: string;
  memberId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

export interface EligibleSessionRow {
  sessionId: string;
  className: string;
  trainerName: string;
  completedAt: Date;
}

export interface AverageRow {
  entityId: string;
  name: string;
  reviewCount: number;
  averageRating: number | null;
}

/** Contrato compartido con H39: promedio de calificaciones por entrenador. */
export interface TrainerAverageRow {
  trainerId: string;
  name: string;
  reviewCount: number;
  averageRating: number | null;
}

export type ReviewGroupBy = 'class' | 'trainer';
export type ReviewSort = 'asc' | 'desc';

export interface AverageCriteria {
  groupBy: ReviewGroupBy;
  sort: ReviewSort;
  skip: number;
  take: number;
}

export interface TrainerAverageRange {
  from: string;
  to: string;
}

export interface RowPage<T> {
  rows: T[];
  total: number;
}

export interface CreateReviewCommand {
  memberId: string;
  sessionId: string;
  rating: number;
  comment: string | null;
}

const REVIEW_FIELDS = {
  id: true,
  sessionId: true,
  memberId: true,
  rating: true,
  comment: true,
  createdAt: true,
} satisfies Prisma.ReviewSelect;
@Injectable()
export class ReviewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sesiones evaluables del miembro: COMPLETADA + asistencia ASISTIO y sin
   * reseña previa suya. `completedAt` es COALESCE(cs.completed_at, cs.ends_at)
   * para que una sesión cerrada antes de guardar la marca de cierre conserve
   * la fecha que ve el miembro.
   */
  async findEligibleSessions(
    memberId: string,
    skip: number,
    take: number,
  ): Promise<RowPage<EligibleSessionRow>> {
    const from = this.eligibleFrom(memberId);
    const where = this.eligibleWhere(memberId);
    return serializable(this.prisma, async (tx) => {
      const [rows, counted] = await Promise.all([
        tx.$queryRaw<EligibleSessionRow[]>(Prisma.sql`
          SELECT
            cs.id AS "sessionId",
            ct.name AS "className",
            COALESCE(up.full_name, u.email) AS "trainerName",
            COALESCE(cs.completed_at, cs.ends_at) AS "completedAt"
          ${from}
          WHERE ${where}
          ORDER BY COALESCE(cs.completed_at, cs.ends_at) DESC, cs.id DESC
          LIMIT ${take} OFFSET ${skip}
        `),
        tx.$queryRaw<{ total: bigint }[]>(
          Prisma.sql`SELECT COUNT(*)::bigint AS total ${from} WHERE ${where}`,
        ),
      ]);
      return { rows, total: toNumber(counted[0]?.total) };
    });
  }

  /**
   * Inserta la reseña en una transacción serializable. La unicidad final la
   * pone `reviews_member_session_key`, así que dos INSERT concurrentes no
   * producen 500: P2002 se traduce a 409 con el mismo texto que la
   * comprobación previa.
   */
  async createReview(
    command: CreateReviewCommand,
  ): Promise<ReviewCreationResult> {
    return serializable(this.prisma, async (tx) => {
      const gate = await this.readGate(tx, command);
      if (gate !== 'OPEN') return { kind: gate };
      return this.insert(tx, command);
    });
  }

  async findAverages(criteria: AverageCriteria): Promise<RowPage<AverageRow>> {
    const universe = this.universe(criteria.groupBy);
    const rated = this.rated(criteria.groupBy);
    const direction = this.direction(criteria.sort);
    return serializable(this.prisma, async (tx) => {
      const [rows, counted] = await Promise.all([
        tx.$queryRaw<AverageRow[]>(Prisma.sql`
          WITH entities AS (${universe}),
               scores AS (${rated})
          SELECT
            e.entity_id AS "entityId",
            e.name AS "name",
            COALESCE(s.review_count, 0)::int AS "reviewCount",
            s.average_rating AS "averageRating"
          FROM entities e
          LEFT JOIN scores s ON s.entity_id = e.entity_id
          ORDER BY (s.average_rating IS NULL),
                   s.average_rating ${direction} NULLS LAST,
                   e.name ASC,
                   e.entity_id ASC
          LIMIT ${criteria.take} OFFSET ${criteria.skip}
        `),
        tx.$queryRaw<{ total: bigint }[]>(
          Prisma.sql`
            WITH entities AS (${universe})
            SELECT COUNT(*)::bigint AS total FROM entities
          `,
        ),
      ]);
      return { rows, total: toNumber(counted[0]?.total) };
    });
  }

  /**
   * Promedio por entrenador, sin paginación: es la misma agregación que usa
   * H30 y la consume `src/reports` para H39. Sin evaluaciones devuelve
   * `averageRating: null`, nunca cero.
   */
  async trainerAverages(
    tx?: Prisma.TransactionClient,
    range?: TrainerAverageRange,
  ): Promise<
    Array<{
      trainerId: string;
      name: string;
      reviewCount: number;
      averageRating: number | null;
    }>
  > {
    const universe = this.universe('trainer');
    const rated = this.rated('trainer', range);
    const db = tx ?? this.prisma;
    return db.$queryRaw<TrainerAverageRow[]>(Prisma.sql`
      WITH entities AS (${universe}),
           scores AS (${rated})
      SELECT
        e.entity_id AS "trainerId",
        e.name AS "name",
        COALESCE(s.review_count, 0)::int AS "reviewCount",
        s.average_rating AS "averageRating"
      FROM entities e
      LEFT JOIN scores s ON s.entity_id = e.entity_id
      ORDER BY (s.average_rating IS NULL),
               s.average_rating DESC NULLS LAST,
               e.name ASC
    `);
  }

  private eligibleFrom(memberId: string): Prisma.Sql {
    // H29 menciona sesiones de entrenamiento en el título, pero su modelo
    // técnico solo define Review→ClassSession; no se amplía aquí a
    // PersonalSession sin un contrato de datos acordado.
    return Prisma.sql`
      FROM class_sessions cs
      JOIN class_templates ct ON ct.id = cs.class_template_id
      JOIN users u ON u.id = cs.trainer_id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      JOIN class_reservations cr
        ON cr.session_id = cs.id
       AND cr.member_id = ${memberId}::uuid
    `;
  }

  private eligibleWhere(memberId: string): Prisma.Sql {
    return Prisma.sql`
      cs.status = 'COMPLETADA'::"SessionStatus"
      AND cr.attendance = 'ASISTIO'::"AttendanceStatus"
      AND NOT EXISTS (
        SELECT 1
        FROM reviews done
        WHERE done.session_id = cs.id
          AND done.member_id = ${memberId}::uuid
      )
    `;
  }

  /**
   * Estado del universo de la tabla de promedios (H30).
   *
   * Las plantillas se conservan aunque estén INACTIVAS: sus sesiones
   * COMPLETADA y evaluaciones son historial auditable y H30 no autoriza
   * filtrar el catálogo por estado. Por entrenador entran todos los usuarios
   * con rol ENTRENADOR por la misma razón.
   */
  private universe(groupBy: ReviewGroupBy): Prisma.Sql {
    if (groupBy === 'class') {
      return Prisma.sql`
        SELECT ct.id AS entity_id, ct.name AS name
        FROM class_templates ct
      `;
    }
    return Prisma.sql`
      SELECT u.id AS entity_id, COALESCE(up.full_name, u.email) AS name
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.role = 'ENTRENADOR'::"UserRole"
    `;
  }

  /**
   * averageRating = ROUND(SUM(rating) / COUNT(review.id), 1) y solo cuenta
   * reseñas de sesiones COMPLETADA con asistencia ASISTIO del mismo miembro.
   * El filtro `rating BETWEEN 1 AND 5` descarta evaluaciones inválidas que
   * hubieran entrado por otra vía; el CHECK de la base es la primera barrera.
   */
  private rated(
    groupBy: ReviewGroupBy,
    trainerRange?: TrainerAverageRange,
  ): Prisma.Sql {
    const key = this.groupKey(groupBy);
    const rangeFilter = trainerRange
      ? Prisma.sql`AND (cs.starts_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/El_Salvador')::date BETWEEN ${trainerRange.from}::date AND ${trainerRange.to}::date`
      : Prisma.empty;
    return Prisma.sql`
      SELECT
        ${key} AS entity_id,
        COUNT(r.id)::int AS review_count,
        ROUND(SUM(r.rating)::numeric / COUNT(r.id), 1)::float8 AS average_rating
      FROM reviews r
      JOIN class_sessions cs ON cs.id = r.session_id
      JOIN class_reservations cr
        ON cr.session_id = cs.id
       AND cr.member_id = r.member_id
      WHERE cs.status = 'COMPLETADA'::"SessionStatus"
        AND cr.attendance = 'ASISTIO'::"AttendanceStatus"
        AND r.rating BETWEEN 1 AND 5
        ${rangeFilter}
      GROUP BY ${key}
    `;
  }

  private groupKey(groupBy: ReviewGroupBy): Prisma.Sql {
    if (groupBy === 'class') return Prisma.sql`cs.class_template_id`;
    return Prisma.sql`cs.trainer_id`;
  }

  private direction(sort: ReviewSort): Prisma.Sql {
    if (sort === 'asc') return Prisma.sql`ASC`;
    return Prisma.sql`DESC`;
  }

  private async readGate(
    tx: Prisma.TransactionClient,
    command: CreateReviewCommand,
  ): Promise<ReviewGate> {
    const found = await tx.$queryRaw<GateRow[]>(Prisma.sql`
      SELECT
        cs.status::text AS "status",
        cr.attendance::text AS "attendance",
        cr.session_id IS NULL AS "reservationMissing",
        EXISTS (
          SELECT 1
          FROM reviews done
          WHERE done.session_id = cs.id
            AND done.member_id = ${command.memberId}::uuid
        ) AS "alreadyReviewed"
      FROM class_sessions cs
      LEFT JOIN class_reservations cr
        ON cr.session_id = cs.id
       AND cr.member_id = ${command.memberId}::uuid
      WHERE cs.id = ${command.sessionId}::uuid
    `);
    const row = found[0];
    if (!row) return 'SESSION_NOT_VISIBLE';
    if (row.reservationMissing) return 'SESSION_NOT_VISIBLE';
    if (row.status !== SessionStatus.COMPLETADA) return 'SESSION_NOT_COMPLETED';
    if (row.attendance !== AttendanceStatus.ASISTIO)
      return 'ATTENDANCE_MISSING';
    if (row.alreadyReviewed) return 'DUPLICATE';
    return 'OPEN';
  }

  private async insert(
    tx: Prisma.TransactionClient,
    command: CreateReviewCommand,
  ): Promise<ReviewCreationResult> {
    try {
      const review = await tx.review.create({
        data: {
          memberId: command.memberId,
          sessionId: command.sessionId,
          rating: command.rating,
          comment: command.comment,
        },
        select: REVIEW_FIELDS,
      });
      return { kind: 'CREATED', review };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new DomainError('CONFLICT', REVIEW_MESSAGES.duplicateReview);
      }
      throw error;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}

interface GateRow {
  status: string;
  attendance: string | null;
  reservationMissing: boolean;
  alreadyReviewed: boolean;
}

function toNumber(total: bigint | undefined): number {
  if (total === undefined) return 0;
  return Number(total);
}
