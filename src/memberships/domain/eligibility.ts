export interface EligibilityInput {
  startsOn: Date;
  endsOn: Date;
  creditsRemaining: number | null;
  plan: { type: string };
  payment: { status: string; memberId: string; concept: string };
  memberId: string;
}
/** Los Date @db.Date son representaciones UTC de una fecha civil, no instantes locales. */
export function isMembershipEligible(
  value: EligibilityInput,
  today: string,
): boolean {
  return (
    value.payment.status === 'PAGADO' &&
    value.payment.memberId === value.memberId &&
    value.payment.concept === 'MEMBRESIA' &&
    value.startsOn.toISOString().slice(0, 10) <= today &&
    value.endsOn.toISOString().slice(0, 10) >= today &&
    (value.plan.type !== 'BY_CLASSES' || (value.creditsRemaining ?? 0) > 0)
  );
}
