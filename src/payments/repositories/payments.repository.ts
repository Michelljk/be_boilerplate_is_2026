
import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/services/prisma.service.js';

import type {
  PaymentHistoryQueryDto,
  PaymentHistoryResponseDto,
  PaymentHistoryItemDto,
} from '../dto/payment-history.dto.js';

/**
 * H18 — Historial de pagos del miembro.
 */
@Injectable()
export class PaymentsRepository {
  constructor(private readonly db: PrismaService) {}

  async history(
    memberId: string,
    query: PaymentHistoryQueryDto,
  ): Promise<PaymentHistoryResponseDto> {
    const { from, to } = query;

    if (
      (from && !/^\d{4}-\d\d-\d\d$/.test(from)) ||
      (to && !/^\d{4}-\d\d-\d\d$/.test(to))
    ) {
      throw new BadRequestException('Fecha inválida.');
    }

    if (from && to && to < from) {
      throw new BadRequestException(
        'La fecha final no puede ser anterior a la inicial',
      );
    }

    if (from && to) {
      const start = new Date(`${from}T00:00:00Z`);
      const end = new Date(`${to}T00:00:00Z`);
      const max = new Date(start);

      max.setUTCMonth(max.getUTCMonth() + 12);

      if (end > max) {
        throw new BadRequestException(
          'El rango no puede superar 12 meses',
        );
      }
    }

    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 10);

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

    const conditions = [
      'p.member_id = $1::uuid',
      "p.status IN ('PAGADO', 'ANULADO')",
    ];

    const args: unknown[] = [memberId];

    if (from) {
      args.push(from);
      conditions.push(
        `p.paid_at >= $${args.length}::date`,
      );
    }

    if (to) {
      args.push(to);
      conditions.push(
        `p.paid_at < ($${args.length}::date + interval '1 day')`,
      );
    }

    const where = conditions.join(' AND ');

    const count = await this.db.$queryRawUnsafe<
      Array<{ n: number }>
    >(
      `SELECT COUNT(*)::int AS n
       FROM payments p
       WHERE ${where}`,
      ...args,
    );

    args.push(pageSize, (page - 1) * pageSize);

    const data = await this.db.$queryRawUnsafe<
      PaymentHistoryItemDto[]
    >(
      `SELECT
         p.id AS "paymentId",
         r.id AS "receiptId",
         p.paid_at AS "paidAt",
         p.concept,
         p.amount_usd::text AS "amountUsd",
         p.status,
         p.void_reason AS reason
       FROM payments p
       LEFT JOIN receipts r ON r.payment_id = p.id
       WHERE ${where}
       ORDER BY COALESCE(
         p.paid_at,
         p.created_at
       ) DESC, p.id
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
