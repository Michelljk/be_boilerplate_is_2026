import { BadRequestException } from '@nestjs/common';

/** Simulación H16: no comunica con una pasarela real ni persiste PAN/CVV. */
export const H16_APPROVED_LAST4 = '1234';

export interface CardDetails {
  cardNumber: string;
  holder: string;
  expiry: string;
  cvv: string;
}

const CARD_KEYS = ['cardNumber', 'holder', 'expiry', 'cvv'] as const;

export function isH16TestCardApproved(cardNumber: string): boolean {
  return /^\d{16}$/.test(cardNumber) && cardNumber.endsWith(H16_APPROVED_LAST4);
}

/** Valida los cuatro campos comunes antes de invocar la simulación. */
export function validateH16Card(input: unknown): CardDetails {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Datos de tarjeta inválidos.');
  }
  const body = input as Record<string, unknown>;
  const keys = Object.keys(body);
  if (
    keys.some((key) => !CARD_KEYS.includes(key as (typeof CARD_KEYS)[number]))
  ) {
    throw new BadRequestException('Datos de tarjeta inválidos.');
  }
  const cardNumber = typeof body.cardNumber === 'string' ? body.cardNumber : '';
  const holder = typeof body.holder === 'string' ? body.holder : '';
  const expiry = typeof body.expiry === 'string' ? body.expiry : '';
  const cvv = typeof body.cvv === 'string' ? body.cvv : '';
  if (
    !/^\d{16}$/.test(cardNumber) ||
    !/^.{2,60}$/.test(holder) ||
    !/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry) ||
    !/^\d{3}$/.test(cvv)
  ) {
    throw new BadRequestException('Datos de tarjeta inválidos.');
  }
  return { cardNumber, holder, expiry, cvv };
}

/** Responde como una pasarela: siempre espera los dos segundos definidos por H16. */
export async function simulateH16Card(cardNumber: string): Promise<string> {
  await new Promise<void>((resolve) => setTimeout(resolve, 2000));
  if (!isH16TestCardApproved(cardNumber)) {
    throw new BadRequestException({
      code: 'PAYMENT_DECLINED',
      message: 'Pago rechazado por la pasarela simulada.',
    });
  }
  return simulationReference();
}

export function simulationReference(): string {
  return `SIM-${crypto.randomUUID()}`;
}
