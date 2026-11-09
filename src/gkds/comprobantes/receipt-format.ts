
export interface ReceiptData {
  number: number;
  memberName: string;
  concept: string;
  amountUsd: number;
  status: 'PAGADO' | 'ANULADO';
  issuedAt: Date;
}

export interface ReceiptSummary {
  receiptNumber: string;
  memberName: string;
  concept: string;
  amount: string;
  status: string;
  issuedAt: string;
}

export function formatReceiptNumber(number: number): string {
  if (!Number.isSafeInteger(number) || number < 1 || number > 999999) {
    throw new Error('Número de comprobante inválido.');
  }

  return `C-${String(number).padStart(6, '0')}`;
}

export function prepareReceipt(data: ReceiptData): ReceiptSummary {
  const receiptNumber = formatReceiptNumber(data.number);

  if (!data.memberName?.trim()) {
    throw new Error('El nombre del miembro es obligatorio.');
  }

  if (!data.concept?.trim()) {
    throw new Error('El concepto de pago es obligatorio.');
  }

  if (!Number.isFinite(data.amountUsd) || data.amountUsd <= 0) {
    throw new Error('El monto del comprobante debe ser positivo.');
  }

  if (!['PAGADO', 'ANULADO'].includes(data.status)) {
    throw new Error('Estado del pago inválido.');
  }

  if (!(data.issuedAt instanceof Date) ||
      Number.isNaN(data.issuedAt.getTime())) {
    throw new Error('Fecha de emisión inválida.');
  }

  return {
    receiptNumber,
    memberName: data.memberName.trim(),
    concept: data.concept.trim(),
    amount: `USD ${data.amountUsd.toFixed(2)}`,
    status: data.status,
    issuedAt: data.issuedAt.toISOString(),
  };
}
