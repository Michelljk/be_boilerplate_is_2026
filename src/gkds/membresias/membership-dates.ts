
export type MembershipPlanType = 'MONTHLY' | 'QUARTERLY' | 'BY_CLASSES';

export interface MembershipDuration {
  type: MembershipPlanType;
  durationMonths?: number;
  durationDays?: number;
}

export interface MembershipPeriod {
  startsOn: Date;
  endsOn: Date;
}

export function calculateMembershipPeriod(
  start: Date,
  plan: MembershipDuration,
): MembershipPeriod {
  if (Number.isNaN(start.getTime())) {
    throw new Error('Fecha de inicio inválida.');
  }

  const startsOn = new Date(start);
  const endsOn = new Date(start);

  if (plan.type === 'BY_CLASSES') {
    if (
      !Number.isInteger(plan.durationDays) ||
      (plan.durationDays ?? 0) < 1
    ) {
      throw new Error('La duración en días debe ser positiva.');
    }

    endsOn.setUTCDate(
      endsOn.getUTCDate() + (plan.durationDays ?? 0) - 1,
    );
  } else {
    if (!['MONTHLY', 'QUARTERLY'].includes(plan.type)) {
      throw new Error('Tipo de plan inválido.');
    }

    if (
      !Number.isInteger(plan.durationMonths) ||
      (plan.durationMonths ?? 0) < 1
    ) {
      throw new Error('La duración en meses debe ser positiva.');
    }

    endsOn.setUTCMonth(
      endsOn.getUTCMonth() + (plan.durationMonths ?? 0),
    );
    endsOn.setUTCDate(endsOn.getUTCDate() - 1);
  }

  return { startsOn, endsOn };
}

export function calculateRenewalStart(
  now: Date,
  previousEnd: Date | null,
): Date {
  if (!previousEnd || previousEnd < now) {
    return new Date(now);
  }

  const nextStart = new Date(previousEnd);
  nextStart.setUTCDate(nextStart.getUTCDate() + 1);
  return nextStart;
}
