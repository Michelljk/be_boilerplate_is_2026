
export type PaymentStatus = 'PENDIENTE' | 'PAGADO' | 'ANULADO';

export interface PaymentVoidInput {
  paymentId: string;
  status: PaymentStatus;
  reason: string;
  actorId: string;
  actorRole: string;
}

export interface PaymentVoidResult {
  paymentId: string;
  previousStatus: 'PAGADO';
  newStatus: 'ANULADO';
  reason: string;
  voidedBy: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validatePaymentVoid(
  input: PaymentVoidInput,
): PaymentVoidResult {
  if (
    typeof input.paymentId !== 'string' ||
    !UUID_REGEX.test(input.paymentId)
  ) {
    throw new Error('Identificador del pago inválido.');
  }

  if (
    typeof input.actorId !== 'string' ||
    !UUID_REGEX.test(input.actorId)
  ) {
    throw new Error('Identificador del responsable inválido.');
  }

  if (input.actorRole !== 'RECEPCION_ADMIN') {
    throw new Error('No tiene permisos para anular cobros.');
  }

  if (input.status !== 'PAGADO') {
    throw new Error('Solo pueden anularse cobros realizados.');
  }

  if (typeof input.reason !== 'string') {
    throw new Error('El motivo de anulación es obligatorio.');
  }

  const reason = input.reason.trim();

  if (reason.length < 10 || reason.length > 500) {
    throw new Error(
      'El motivo debe contener entre 10 y 500 caracteres.',
    );
  }

  return {
    paymentId: input.paymentId,
    previousStatus: 'PAGADO',
    newStatus: 'ANULADO',
    reason,
    voidedBy: input.actorId,
  };
}
