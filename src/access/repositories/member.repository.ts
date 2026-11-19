import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { Prisma, UserRole } from '@PrismaClient';
import type { EligibilityInput } from '../../memberships/domain/eligibility.js';

/** Tope de resultados del buscador de recepción (H13 · Diseño técnico). */
export const MAX_SEARCH_RESULTS = 20;
/** Tope del directorio compacto compartido por H19/H2. */
export const MAX_DIRECTORY_RESULTS = 10;

const CANDIDATE_INCLUDE = {
  memberProfile: { select: { memberNumber: true } },
  profile: { select: { fullName: true } },
  memberships: {
    select: {
      id: true,
      startsOn: true,
      endsOn: true,
      creditsRemaining: true,
      memberId: true,
      plan: { select: { type: true } },
      payment: { select: { status: true, memberId: true, concept: true } },
    },
  },
} satisfies Prisma.UserInclude;

const DIRECTORY_SELECT = {
  id: true,
  email: true,
  memberProfile: { select: { memberNumber: true } },
  profile: { select: { fullName: true } },
} satisfies Prisma.UserSelect;

type MemberWithRelations = Prisma.UserGetPayload<{
  include: typeof CANDIDATE_INCLUDE;
}>;

type MemberDirectoryRow = Prisma.UserGetPayload<{
  select: typeof DIRECTORY_SELECT;
}>;

type DatabaseClient = PrismaService | Prisma.TransactionClient;

export interface MemberCandidate {
  readonly memberId: string;
  readonly memberNumber: string;
  readonly memberName: string;
  readonly memberships: readonly EligibilityInput[];
}

export interface MemberDirectoryCandidate {
  readonly memberId: string;
  readonly memberNumber: string;
  readonly fullName: string;
}

@Injectable()
export class MemberRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Miembros activos cuyo `memberNumber` coincide de forma exacta, o cuyo
   * nombre contiene el texto sin distinguir mayúsculas. Otros roles y los
   * inactivos nunca aparecen: el buscador no divulga cuentas ajenas.
   */
  async search(term: string): Promise<MemberCandidate[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role: UserRole.MIEMBRO,
        isActive: true,
        OR: [
          { memberProfile: { memberNumber: term } },
          { profile: { fullName: { contains: term, mode: 'insensitive' } } },
        ],
      },
      include: CANDIDATE_INCLUDE,
      orderBy: [{ profile: { fullName: 'asc' } }],
      take: MAX_SEARCH_RESULTS,
    });

    return users.map((user) => toCandidate(user));
  }

  /**
   * Directorio compacto de recepción para H19/H2. Mantiene la identidad y
   * filtros del buscador H13, pero usa una proyección y límite propios para
   * no mezclar su contrato exacto con `/access/members`.
   */
  async searchDirectory(term: string): Promise<MemberDirectoryCandidate[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role: UserRole.MIEMBRO,
        isActive: true,
        OR: [
          { memberProfile: { memberNumber: term } },
          { profile: { fullName: { contains: term, mode: 'insensitive' } } },
        ],
      },
      select: DIRECTORY_SELECT,
      orderBy: [{ profile: { fullName: 'asc' } }, { id: 'asc' }],
      take: MAX_DIRECTORY_RESULTS,
    });

    return users.map(toDirectoryCandidate);
  }

  /**
   * Miembro activo con su perfil y sus membresías, o `null` si no existe.
   * `client` permite leer dentro de la transacción que registra el ingreso.
   */
  async findMember(
    memberId: string,
    client: DatabaseClient = this.prisma,
  ): Promise<MemberCandidate | null> {
    const user = await client.user.findFirst({
      where: { id: memberId, role: UserRole.MIEMBRO, isActive: true },
      include: CANDIDATE_INCLUDE,
    });

    return user ? toCandidate(user) : null;
  }
}

function toCandidate(user: MemberWithRelations): MemberCandidate {
  return {
    memberId: user.id,
    memberNumber: user.memberProfile?.memberNumber ?? '',
    memberName: user.profile?.fullName ?? user.email,
    memberships: user.memberships,
  };
}

function toDirectoryCandidate(
  user: MemberDirectoryRow,
): MemberDirectoryCandidate {
  return {
    memberId: user.id,
    memberNumber: user.memberProfile?.memberNumber ?? '',
    fullName: user.profile?.fullName ?? user.email,
  };
}
