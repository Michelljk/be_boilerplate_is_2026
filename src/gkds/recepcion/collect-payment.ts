import { BadRequestException } from '@nestjs/common';
import { isH16TestCardApproved } from '../../payments/payment-card-simulation.js';

export type CollectionMethod = 'EFECTIVO' | 'TARJETA';

export type CollectionStatus = 'PENDIENTE' | 'PAGADO' | 'ANULADO';

export interface CollectionInput {
  paymentId: string;
  status: CollectionStatus;
  amountUsd: number;
  method: CollectionMethod;
  cardLast4?: string;
}

export interface CollectionResult {
  paymentId: string;
  status: 'PAGADO';
  method: CollectionMethod;
  amountUsd: string;
  cardLast4: string | null;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateCollection(input: CollectionInput): CollectionResult {
  if (!UUID_REGEX.test(input.paymentId)) {
    throw new BadRequestException('Identificador del pago inválido.');
  }

  if (input.status !== 'PENDIENTE') {
    throw new BadRequestException('Solo se pueden cobrar pagos pendientes.');
  }

  if (
    !Number.isFinite(input.amountUsd) ||
    input.amountUsd <= 0 ||
    Math.round(input.amountUsd * 100) !== input.amountUsd * 100
  ) {
    throw new BadRequestException('Monto inválido.');
  }

  if (!['EFECTIVO', 'TARJETA'].includes(input.method)) {
    throw new BadRequestException('Método de pago inválido.');
  }

  if (input.method === 'TARJETA') {
    if (!/^\d{4}$/.test(input.cardLast4 ?? '')) {
      throw new BadRequestException(
        'Se requieren cuatro dígitos de tarjeta válidos.',
      );
    }

    if (!isH16TestCardApproved(`000000000000${input.cardLast4}`)) {
      throw new BadRequestException('Pago simulado rechazado.');
    }
  }

  return {
    paymentId: input.paymentId,
    status: 'PAGADO',
    method: input.method,
    amountUsd: input.amountUsd.toFixed(2),
    cardLast4: input.method === 'TARJETA' ? input.cardLast4! : null,
  };
}
