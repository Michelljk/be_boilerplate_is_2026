import { Injectable } from '@nestjs/common';
import type { User } from '@PrismaClient';
import { GymClock } from '@Common/time';
import { assertReceptionAdmin } from '../domain/authorization.js';
import type { RegisterCheckInDto } from '../dto/access-request.dto.js';
import { CheckInRepository } from '../repositories/check-in.repository.js';

@Injectable()
export class AccessService {
  constructor(
    private readonly checkIns: CheckInRepository,
    private readonly clock: GymClock,
  ) {}

  async register(input: RegisterCheckInDto, actor: User) {
    assertReceptionAdmin(actor);
    const now = this.clock.now();
    const civilDay = this.clock.dateOf(now);
    return this.checkIns.record({
      memberId: input.memberId,
      registeredById: actor.id,
      checkedInAt: now,
      checkInDate: this.clock.dateOnly(civilDay),
      civilDay,
      confirmExpired: input.confirmExpired ?? false,
    });
  }
}
