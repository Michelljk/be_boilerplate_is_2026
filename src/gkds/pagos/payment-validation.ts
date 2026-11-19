
export type PaymentConcept =
  | 'MEMBRESIA'
  | 'SESION_ADICIONAL'
  | 'SESION_PERSONAL';

export type PaymentStatus =
  | 'PENDIENTE'
  | 'PAGADO'
  | 'ANULADO';

export interface PaymentInput {
  concept: PaymentConcept;
  amountUsd: number;
  status: PaymentStatus;
}

export type CardResult = 'APPROVED' | 'DECLINED';

export function validatePayment(payment: PaymentInput): void {
  const concepts = [
    'MEMBRESIA',
    'SESION_ADICIONAL',
    'SESION_PERSONAL',
  ];

  if (!concepts.includes(payment.concept)) {
    throw new Error('Concepto de pago inválido.');
  }

  if (
    !Number.isFinite(payment.amountUsd) ||
    payment.amountUsd <= 0 ||
    Math.round(payment.amountUsd * 100) !== payment.amountUsd * 100
  ) {
    throw new Error('El monto debe ser positivo y tener máximo dos decimales.');
  }

  if (payment.status !== 'PENDIENTE') {
    throw new Error('Solo se pueden procesar pagos pendientes.');
  }
}

export function simulateCardPayment(last4: string): CardResult {
  if (!/^\d{4}$/.test(last4)) {
    throw new Error('Últimos cuatro dígitos inválidos.');
  }

  // Regla exclusivamente de simulación para el proyecto.
  return last4 === '4242' ? 'APPROVED' : 'DECLINED';
}

export function getNextPaymentStatus(
  current: PaymentStatus,
  result: CardResult,
): PaymentStatus {
  if (current !== 'PENDIENTE') {
    throw new Error('El pago ya fue procesado o anulado.');
  }

  return result === 'APPROVED' ? 'PAGADO' : 'PENDIENTE';
}
