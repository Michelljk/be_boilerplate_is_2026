import { Injectable } from '@nestjs/common';
import { DomainError } from '@Common/errors';
import { GymClock } from '@Common/time';
import {
  membershipStatusOf,
  latestEndsOn,
  currentMembershipId,
} from '../domain/membership-status.js';
import {
  MemberRepository,
  type MemberCandidate,
} from '../repositories/member.repository.js';

export interface MemberSummary {
  readonly memberId: string;
  readonly memberNumber: string;
  readonly memberName: string;
  readonly membership: {
    readonly membershipId: string | null;
    readonly status: ReturnType<typeof membershipStatusOf>;
    readonly endsOn: string | null;
  };
}

@Injectable()
export class MemberSearchService {
  constructor(
    private readonly members: MemberRepository,
    private readonly clock: GymClock,
  ) {}

  async search(term: string): Promise<MemberSummary[]> {
    const q = term.trim();
    if (q.length < 2 || q.length > 80) {
      throw new DomainError(
        'INVALID',
        'La búsqueda debe tener entre 2 y 80 caracteres.',
      );
    }
    const found = await this.members.search(q);
    return found.map((member) => this.toSummary(member));
  }

  private toSummary(member: MemberCandidate): MemberSummary {
    const endsOn = latestEndsOn(member.memberships);
    return {
      memberId: member.memberId,
      memberNumber: member.memberNumber,
      memberName: member.memberName,
      membership: {
        membershipId: currentMembershipId(
          member.memberships,
          this.clock.today(),
        ),
        status: membershipStatusOf(member.memberships, this.clock.today()),
        endsOn: endsOn ? endsOn.toISOString().slice(0, 10) : null,
      },
    };
  }
}
