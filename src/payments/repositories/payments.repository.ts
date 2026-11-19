
import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/services/prisma.service.js';
import { GymClock } from '../../common/time/gym-clock.service.js';

import type {
  PaymentPendingQueryDto,
} from '../dto/payment-pending.dto.js';

const CONCEPTS = [
  'MEMBRESIA',
  'SESION_ADICIONAL',
  'SESION_PERSONAL',
];

const OVERDUE_RANGES = [
  'NONE',
  'D1_30',
  'D31_60',
  'OVER_60',
];

interface PendingPaymentRow {
  paymentId: string;
  memberNumber: string | null;
  memberName: string;
  concept: string;
  amountUsd: string;
  dueDate: string;
  daysOverdue: number;
}

interface PendingPaymentResponse {
  data: PendingPaymentRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Repositorio de pagos.
 * H20: consulta administrativa de pagos pendientes.
 */
@Injectable()
export class PaymentsRepository {
  constructor(
    private readonly db: PrismaService,
    private readonly clock: GymClock,
  ) {}

  private query<T>(
    sql: string,
    ...args: unknown[]
  ): Promise<T[]> {
    return this.db.$queryRawUnsafe<T[]>(sql, ...args);
  }

  async pending(
    query: PaymentPendingQueryDto,
  ): Promise<PendingPaymentResponse> {
    // Validación del concepto.
    if (
      query.concept &&
      !CONCEPTS.includes(query.concept)
    ) {
      throw new BadRequestException(
        'Concepto no reconocido.',
      );
    }

    // Validación del rango de atraso.
    if (
      query.overdue &&
      !OVERDUE_RANGES.includes(query.overdue)
    ) {
      throw new BadRequestException(
        'Rango de atraso incorrecto.',
      );
    }

    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 20);

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 50
    ) {
      throw new BadRequestException(
        'Paginación inválida.',
      );
    }

    // Fecha civil del gimnasio en El Salvador.
    const today = this.clock.today();

    const conditions: string[] = [
      "p.status = 'PENDIENTE'",
    ];

    const args: unknown[] = [today];

    // Filtro por concepto.
    if (query.concept) {
      args.push(query.concept);

      conditions.push(
        `p.concept = $${args.length}`,
      );
    }

    // Diferencia de días calendario, mínimo cero.
    const overdueExpression =
      'GREATEST(0, ($1::date - p.due_date::date))';

    // Filtro por rango de atraso.
    if (query.overdue) {
      switch (query.overdue) {
        case 'NONE':
          conditions.push(
            `${overdueExpression} = 0`,
          );
          break;

        case 'D1_30':
          conditions.push(
            `${overdueExpression} BETWEEN 1 AND 30`,
          );
          break;

        case 'D31_60':
          conditions.push(
            `${overdueExpression} BETWEEN 31 AND 60`,
          );
          break;

        case 'OVER_60':
          conditions.push(
            `${overdueExpression} > 60`,
          );
          break;
      }
    }

    const where = conditions.join(' AND ');

    // Total de pagos pendientes según los filtros.
    const count = await this.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n
       FROM payments p
       WHERE ${where}`,
      ...args,
    );

    // Parámetros de paginación.
    args.push(
      pageSize,
      (page - 1) * pageSize,
    );

    // Consulta principal de H20.
    const data = await this.query<PendingPaymentRow>(
      `SELECT
         p.id AS "paymentId",
         mp.member_number AS "memberNumber",
         COALESCE(
           up.full_name,
           u.email
         ) AS "memberName",
         p.concept::text AS concept,
         p.amount_usd::text AS "amountUsd",
         to_char(
           p.due_date,
           'YYYY-MM-DD'
         ) AS "dueDate",
         ${overdueExpression}::int AS "daysOverdue"
       FROM payments p
       JOIN users u
         ON u.id = p.member_id
       LEFT JOIN member_profiles mp
         ON mp.user_id = u.id
       LEFT JOIN user_profiles up
         ON up.user_id = u.id
       WHERE ${where}
       ORDER BY
         "daysOverdue" DESC,
         p.due_date ASC,
         p.id ASC
       LIMIT $${args.length - 1}
       OFFSET $${args.length}`,
      ...args,
    );

    return {
      data,
      total: count[0]?.n ?? 0,
      page,
      pageSize,
    };
  }
}
