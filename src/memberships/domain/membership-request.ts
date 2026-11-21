/**
 * Operación que registra recepción (H2). La columna es TEXT con una restricción
 * CHECK en la base, por eso se modela con uniones literales en lugar de enum.
 */
export const MEMBERSHIP_OPERATIONS = ['COMPRA', 'RENOVACION'] as const;
export type MembershipOperation = (typeof MEMBERSHIP_OPERATIONS)[number];

export const MEMBERSHIP_REQUEST_STATUSES = [
  'PENDIENTE_PAGO',
  'APLICADA',
  'CANCELADA',
] as const;
export type MembershipRequestStatus =
  (typeof MEMBERSHIP_REQUEST_STATUSES)[number];

/** Estado que devuelve H2 mientras el Módulo 5 no confirme el cobro. */
export const PENDING_PAYMENT: MembershipRequestStatus = 'PENDIENTE_PAGO';
