import type { Prisma } from '../../generated/prisma/client.js';
import { DomainError } from '../../common/errors/domain.error.js';
import { isMembershipEligible } from '../domain/eligibility.js';
/** Usar dentro de una transacción tras bloquear al miembro; única regla de elegibilidad. */
export async function eligibleMembership(
  tx: Prisma.TransactionClient,
  memberId: string,
  today: string,
) {
  const rows = await tx.membership.findMany({
    where: { memberId },
    include: { plan: true, payment: true },
    orderBy: [{ endsOn: 'desc' }, { id: 'asc' }],
  });
  const membership = rows.find((row) => isMembershipEligible(row, today));
  if (!membership)
    throw new DomainError(
      'CONFLICT',
      'El miembro no tiene una membresía vigente.',
    );
  return membership;
}
