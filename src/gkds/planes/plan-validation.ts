
export type PlanType = 'MONTHLY' | 'QUARTERLY' | 'BY_CLASSES';
export type PlanStatus = 'ACTIVO' | 'INACTIVO';

export interface PlanInput {
  name: string;
  type: PlanType;
  priceUsd: number;
  benefits: string[];
  durationMonths?: number;
  durationDays?: number;
  classCredits?: number;
  status?: PlanStatus;
}

export function validatePlanInput(data: PlanInput): void {
  if (
    typeof data.name !== 'string' ||
    data.name.trim().length < 3 ||
    data.name.trim().length > 80
  ) {
    throw new Error('El nombre debe tener entre 3 y 80 caracteres.');
  }

  if (!['MONTHLY', 'QUARTERLY', 'BY_CLASSES'].includes(data.type)) {
    throw new Error('Tipo de plan inválido.');
  }

  if (
    !Number.isFinite(data.priceUsd) ||
    data.priceUsd < 0
  ) {
    throw new Error('El precio debe ser un número no negativo.');
  }

  if (
    !Array.isArray(data.benefits) ||
    data.benefits.some((benefit) => typeof benefit !== 'string')
  ) {
    throw new Error('Los beneficios deben ser una lista de textos.');
  }

  if (
    data.status !== undefined &&
    !['ACTIVO', 'INACTIVO'].includes(data.status)
  ) {
    throw new Error('Estado de plan inválido.');
  }

  if (data.type === 'BY_CLASSES') {
    if (
      !Number.isInteger(data.classCredits) ||
      (data.classCredits ?? 0) < 1 ||
      !Number.isInteger(data.durationDays) ||
      (data.durationDays ?? 0) < 1
    ) {
      throw new Error(
        'Un plan por clases requiere créditos y días válidos.',
      );
    }
  } else {
    if (
      !Number.isInteger(data.durationMonths) ||
      (data.durationMonths ?? 0) < 1
    ) {
      throw new Error(
        'La duración en meses debe ser al menos 1.',
      );
    }
  }
}
