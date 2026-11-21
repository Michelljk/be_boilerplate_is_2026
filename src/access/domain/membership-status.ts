import { CheckInMembershipStatus } from '@PrismaClient';
import {
  isMembershipEligible,
  type EligibilityInput,
} from '../../memberships/domain/eligibility.js';

/**
 * Estado de la membresía de un miembro en un día civil.
 *
 * La definición de «vigente» NO se reimplementa aquí: se delega en la regla
 * canónica de `src/memberships/domain/eligibility.ts` (H14 · Backend 1).
 * `rows` debe traer el plan y el pago de cada membresía.
 */
export function membershipStatusOf(
  rows: readonly EligibilityInput[],
  civilDay: string,
): CheckInMembershipStatus {
  if (rows.length === 0) {
    return CheckInMembershipStatus.SIN_MEMBRESIA;
  }

  const eligible = rows.some((row) => isMembershipEligible(row, civilDay));

  return eligible
    ? CheckInMembershipStatus.VIGENTE
    : CheckInMembershipStatus.VENCIDA;
}

/** Último día civil de vencimiento conocido; `null` si no tiene membresías. */
export function latestEndsOn(rows: readonly EligibilityInput[]): Date | null {
  let latest: Date | null = null;

  for (const row of rows) {
    if (latest === null || row.endsOn.getTime() > latest.getTime()) {
      latest = row.endsOn;
    }
  }

  return latest;
}

/** H2 needs the identifier of a currently eligible membership for renewal. */
export function currentMembershipId(
  rows: readonly EligibilityInput[],
  civilDay: string,
): string | null {
  return rows.find((row) => isMembershipEligible(row, civilDay))?.id ?? null;
}

/** Agrupa las membresías leídas por miembro para resolver su estado. */
export function groupByMember(
  rows: readonly EligibilityInput[],
): Map<string, EligibilityInput[]> {
  const grouped = new Map<string, EligibilityInput[]>();

  for (const row of rows) {
    const bucket = grouped.get(row.memberId);
    if (bucket) {
      bucket.push(row);
    } else {
      grouped.set(row.memberId, [row]);
    }
  }

  return grouped;
}
