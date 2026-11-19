import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { Prisma, type CheckInMembershipStatus } from '@PrismaClient';
import { DomainError } from '@Common/errors';
import { serializable } from '@Common/repositories';
import {
  DUPLICATE_CHECK_IN_MESSAGE,
  MEMBER_NOT_FOUND_MESSAGE,
  evaluateCheckIn,
} from '../domain/check-in.policy.js';
import { membershipStatusOf } from '../domain/membership-status.js';
import type { MemberCandidate } from './member.repository.js';
import { MemberRepository } from './member.repository.js';

export interface RecordCheckInInput {
  readonly memberId: string;
  readonly registeredById: string;
  readonly checkedInAt: Date;
  readonly checkInDate: Date;
  readonly civilDay: string;
  readonly confirmExpired: boolean;
}

export interface CheckInSnapshot {
  readonly id: string;
  readonly memberNumber: string;
  readonly memberName: string;
  readonly checkedInAt: Date;
  readonly membershipStatus: CheckInMembershipStatus;
  readonly expiredConfirmed: boolean;
}

const CREATED_FIELDS = {
  id: true,
  checkedInAt: true,
  membershipStatus: true,
  expiredConfirmed: true,
} satisfies Prisma.CheckInSelect;

type CreatedCheckIn = Prisma.CheckInGetPayload<{
  select: typeof CREATED_FIELDS;
}>;

@Injectable()
export class CheckInRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MemberRepository,
  ) {}

  /**
   * Lee al miembro, resuelve su estado, comprueba el ingreso del día e
   * inserta el registro dentro de UNA sola transacción Serializable.
   *
   * El índice único `(member_id, check_in_date)` es la garantía final contra
   * el doble ingreso del mismo día: dos intentos concurrentes producen `P2002`
   * y se traducen al mismo 409 de duplicado.
   */
  async record(input: RecordCheckInInput): Promise<CheckInSnapshot> {
    return serializable(this.prisma, async (tx) => {
      const member = await this.members.findMember(input.memberId, tx);
      if (!member) {
        throw new DomainError('NOT_FOUND', MEMBER_NOT_FOUND_MESSAGE);
      }

      const membershipStatus = membershipStatusOf(
        member.memberships,
        input.civilDay,
      );
      const alreadyCheckedInToday = await this.isCheckedInToday(tx, input);
      const decision = evaluateCheckIn({
        membershipStatus,
        alreadyCheckedInToday,
        confirmExpired: input.confirmExpired,
      });
      if (!decision.allowed) {
        throw decision.error;
      }

      const created = await this.insert(tx, input, membershipStatus, decision);

      return toSnapshot(created, member);
    });
  }

  private async isCheckedInToday(
    tx: Prisma.TransactionClient,
    input: RecordCheckInInput,
  ): Promise<boolean> {
    const existing = await tx.checkIn.findUnique({
      where: {
        memberId_checkInDate: {
          memberId: input.memberId,
          checkInDate: input.checkInDate,
        },
      },
      select: { id: true },
    });

    return existing !== null;
  }

  private insert(
    tx: Prisma.TransactionClient,
    input: RecordCheckInInput,
    membershipStatus: CheckInMembershipStatus,
    decision: { readonly allowed: true; readonly expiredConfirmed: boolean },
  ): Promise<CreatedCheckIn> {
    return tx.checkIn
      .create({
        data: {
          memberId: input.memberId,
          registeredById: input.registeredById,
          checkedInAt: input.checkedInAt,
          checkInDate: input.checkInDate,
          membershipStatus,
          expiredConfirmed: decision.expiredConfirmed,
        },
        select: CREATED_FIELDS,
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) {
          throw new DomainError('CONFLICT', DUPLICATE_CHECK_IN_MESSAGE);
        }
        throw error;
      });
  }
}

function toSnapshot(
  created: CreatedCheckIn,
  member: MemberCandidate,
): CheckInSnapshot {
  return {
    id: created.id,
    memberNumber: member.memberNumber,
    memberName: member.memberName,
    checkedInAt: created.checkedInAt,
    membershipStatus: created.membershipStatus,
    expiredConfirmed: created.expiredConfirmed,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
