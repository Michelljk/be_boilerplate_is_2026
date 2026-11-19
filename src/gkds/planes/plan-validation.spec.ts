
import { describe, expect, it } from 'vitest';
import { validatePlanInput, type PlanInput } from './plan-validation.js';

const monthlyPlan: PlanInput = {
  name: 'Plan mensual',
  type: 'MONTHLY',
  priceUsd: 30,
  durationMonths: 1,
  benefits: ['Acceso general', 'Clases grupales'],
  status: 'ACTIVO',
};

describe('H3 - Validación de planes', () => {
  it('acepta un plan mensual válido', () => {
    expect(() => validatePlanInput(monthlyPlan)).not.toThrow();
  });

  it('rechaza nombres demasiado cortos', () => {
    expect(() =>
      validatePlanInput({ ...monthlyPlan, name: 'AB' }),
    ).toThrow();
  });

  it('rechaza precios negativos', () => {
    expect(() =>
      validatePlanInput({ ...monthlyPlan, priceUsd: -10 }),
    ).toThrow();
  });

  it('exige créditos y días en planes por clases', () => {
    expect(() =>
      validatePlanInput({
        ...monthlyPlan,
        type: 'BY_CLASSES',
        durationMonths: undefined,
        durationDays: 30,
        classCredits: 10,
      }),
    ).not.toThrow();

    expect(() =>
      validatePlanInput({
        ...monthlyPlan,
        type: 'BY_CLASSES',
        durationMonths: undefined,
        durationDays: 30,
        classCredits: 0,
      }),
    ).toThrow();
  });

  it('rechaza un estado inválido', () => {
    expect(() =>
      validatePlanInput({
        ...monthlyPlan,
        status: 'ELIMINADO' as PlanInput['status'],
      }),
    ).toThrow();
  });
});
