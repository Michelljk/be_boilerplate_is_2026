import { describe, expect, it, vi } from 'vitest';
import { CheckInMembershipStatus, Prisma, UserRole } from '@PrismaClient';
import { DomainError } from '@Common/errors';
import { GymClock } from '@Common/time';
import {
  evaluateCheckIn,
  DUPLICATE_CHECK_IN_MESSAGE,
} from '../domain/check-in.policy.js';
import {
  MembershipAlertRequiredError,
  MEMBERSHIP_ALERT_CODE,
  MEMBERSHIP_ALERT_MESSAGE,
} from '../domain/membership-alert.error.js';
import { assertReceptionAdmin } from '../domain/authorization.js';
import {
  resolveHistoryRange,
  MAX_PAGE_SIZE,
  MAX_HISTORY_RANGE_DAYS,
} from '../domain/check-in-history.policy.js';
import { AccessService } from './access.service.js';
import { CheckInHistoryService } from './check-in-history.service.js';
import { MemberSearchService } from './member-search.service.js';
import { MemberDirectoryService } from './member-directory.service.js';
import { MemberSearchResponseDto } from '../dto/access-response.dto.js';
import { MemberDirectoryResponseDto } from '../dto/member-directory.dto.js';
import { AccessController } from '../controllers/access.controller.js';
import { MemberDirectoryController } from '../controllers/member-directory.controller.js';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator.js';
import { CheckInHistoryRepository } from '../repositories/check-in-history.repository.js';

describe('H13/H14 check-in', () => {
  it('uses server clock and JWT actor rather than caller timestamps', async () => {
    const now = new Date('2026-11-12T05:30:00.000Z');
    const clock = {
      now: () => now,
      dateOf: () => '2026-11-11',
      dateOnly: (day: string) => new Date(`${day}T00:00:00.000Z`),
    } as GymClock;
    const repository = { record: vi.fn().mockResolvedValue({ id: 'x' }) };
    const service = new AccessService(repository as never, clock);
    const actor = {
      id: 'reception-id',
      role: UserRole.RECEPCION_ADMIN,
    } as never;
    await service.register(
      { memberId: 'member-id', confirmExpired: false },
      actor,
    );
    expect(repository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: 'member-id',
        registeredById: 'reception-id',
        checkedInAt: now,
        civilDay: '2026-11-11',
        checkInDate: new Date('2026-11-11T00:00:00.000Z'),
      }),
    );
  });

  it('rejects roles other than reception', () => {
    expect(() =>
      assertReceptionAdmin({ role: UserRole.MIEMBRO } as never),
    ).toThrow(DomainError);
    expect(() =>
      assertReceptionAdmin({ role: UserRole.ENTRENADOR } as never),
    ).toThrow(DomainError);
  });

  it('returns exact expired-membership conflict, stores confirmation, and still rejects duplicates', () => {
    const missingConfirmation = evaluateCheckIn({
      membershipStatus: CheckInMembershipStatus.VENCIDA,
      alreadyCheckedInToday: false,
      confirmExpired: false,
    });
    expect(missingConfirmation.allowed).toBe(false);
    if (!missingConfirmation.allowed) {
      expect(missingConfirmation.error).toBeInstanceOf(
        MembershipAlertRequiredError,
      );
      expect(missingConfirmation.error.message).toBe(MEMBERSHIP_ALERT_MESSAGE);
      expect(
        (missingConfirmation.error as MembershipAlertRequiredError).code,
      ).toBe(MEMBERSHIP_ALERT_CODE);
    }
    const confirmed = evaluateCheckIn({
      membershipStatus: CheckInMembershipStatus.SIN_MEMBRESIA,
      alreadyCheckedInToday: false,
      confirmExpired: true,
    });
    expect(confirmed).toEqual({ allowed: true, expiredConfirmed: true });
    const duplicate = evaluateCheckIn({
      membershipStatus: CheckInMembershipStatus.VIGENTE,
      alreadyCheckedInToday: true,
      confirmExpired: false,
    });
    expect(duplicate.allowed).toBe(false);
    if (!duplicate.allowed)
      expect(duplicate.error.message).toBe(DUPLICATE_CHECK_IN_MESSAGE);

    const expiredDuplicate = evaluateCheckIn({
      membershipStatus: CheckInMembershipStatus.VENCIDA,
      alreadyCheckedInToday: true,
      confirmExpired: false,
    });
    expect(expiredDuplicate).toMatchObject({
      allowed: false,
      rejection: 'ALREADY_CHECKED_IN',
    });
    if (!expiredDuplicate.allowed) {
      expect(expiredDuplicate.error.kind).toBe('CONFLICT');
      expect(expiredDuplicate.error.message).toBe(DUPLICATE_CHECK_IN_MESSAGE);
      expect(expiredDuplicate.error).not.toBeInstanceOf(
        MembershipAlertRequiredError,
      );
    }
  });
});

describe('H13 member search', () => {
  it('keeps member search restricted to reception administration', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AccessController)).toEqual([
      UserRole.RECEPCION_ADMIN,
    ]);
  });

  it('exposes a separate exact H19 directory contract for reception', async () => {
    expect(Reflect.getMetadata(ROLES_KEY, MemberDirectoryController)).toEqual([
      UserRole.RECEPCION_ADMIN,
    ]);
    const members = {
      searchDirectory: vi.fn().mockResolvedValue([
        {
          memberId: 'id',
          memberNumber: 'M-1',
          fullName: 'Member',
        },
      ]),
    };
    const service = new MemberDirectoryService(members as never);
    await expect(service.search('x')).rejects.toMatchObject({
      kind: 'INVALID',
    });
    await expect(service.search('a'.repeat(61))).rejects.toMatchObject({
      kind: 'INVALID',
    });
    const response = MemberDirectoryResponseDto.fromCandidates(
      await service.search('  Member  '),
    );
    expect(response).toEqual({
      data: [{ memberId: 'id', memberNumber: 'M-1', fullName: 'Member' }],
    });
    expect(members.searchDirectory).toHaveBeenCalledWith('Member');
  });

  it('rejects query outside 2..80 and maps membership status from server clock', async () => {
    const members = {
      search: vi.fn().mockResolvedValue([
        {
          memberId: 'id',
          memberNumber: 'M-1',
          memberName: 'Member',
          memberships: [],
        },
      ]),
    };
    const clock = { today: () => '2026-11-11' } as GymClock;
    const service = new MemberSearchService(members as never, clock);
    await expect(service.search('x')).rejects.toMatchObject({
      kind: 'INVALID',
    });
    expect(await service.search('  Member  ')).toEqual([
      expect.objectContaining({
        membership: {
          membershipId: null,
          status: CheckInMembershipStatus.SIN_MEMBRESIA,
          endsOn: null,
        },
      }),
    ]);
    expect(members.search).toHaveBeenCalledWith('Member');
  });

  it('returns the ID of an eligible paid current membership in the API contract, not a historical or unpaid one', async () => {
    const membership = {
      id: 'membership-current',
      memberId: 'member-id',
      startsOn: new Date('2026-11-01T00:00:00.000Z'),
      endsOn: new Date('2026-12-01T00:00:00.000Z'),
      creditsRemaining: null,
      plan: { type: 'MONTHLY' },
      payment: {
        status: 'PAGADO',
        memberId: 'member-id',
        concept: 'MEMBRESIA',
      },
    };
    const members = {
      search: vi.fn().mockResolvedValue([
        {
          memberId: 'member-id',
          memberNumber: 'M-001',
          memberName: 'Member',
          memberships: [membership],
        },
      ]),
    };
    const service = new MemberSearchService(
      members as never,
      { today: () => '2026-11-19' } as GymClock,
    );
    const summaries = await service.search('Member');
    expect(summaries[0].membership.membershipId).toBe('membership-current');
    const response = MemberSearchResponseDto.fromSummaries(summaries);
    expect(response).toEqual({
      data: [
        expect.objectContaining({
          memberId: 'member-id',
          membership: expect.objectContaining({
            membershipId: 'membership-current',
            status: CheckInMembershipStatus.VIGENTE,
            endsOn: '2026-12-01',
          }),
        }),
      ],
    });
    membership.payment.status = 'PENDIENTE';
    expect(
      (await service.search('Member'))[0].membership.membershipId,
    ).toBeNull();
  });
});

describe('H15 history', () => {
  it('rejects inverted and over-90-day civil ranges with specified limits', () => {
    expect(() =>
      resolveHistoryRange(
        { from: '2026-11-12', to: '2026-11-11' },
        '2026-11-11',
      ),
    ).toThrow('La fecha inicial no puede ser posterior a la final');
    expect(() =>
      resolveHistoryRange(
        { from: '2026-01-01', to: '2026-04-01' },
        '2026-11-11',
      ),
    ).toThrow(`El rango no puede superar ${MAX_HISTORY_RANGE_DAYS} días.`);
    expect(MAX_PAGE_SIZE).toBe(20);
  });

  it('uses 30-day default and applies civil date range, member filter and bounded page', async () => {
    const repository = {
      paginate: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    };
    const clock = {
      today: () => '2026-11-11',
      dateOnly: (day: string) => new Date(`${day}T00:00:00.000Z`),
    } as GymClock;
    const service = new CheckInHistoryService(repository as never, clock);
    const page = await service.history({
      memberNumber: ' M-10 ',
      page: 2,
      pageSize: 20,
    });
    expect(page.page).toBe(2);
    expect(repository.paginate).toHaveBeenCalledWith(
      expect.objectContaining({
        from: new Date('2026-10-13T00:00:00.000Z'),
        to: new Date('2026-11-11T00:00:00.000Z'),
        memberNumber: 'M-10',
        skip: 20,
        take: 20,
      }),
    );
  });

  it('reads rows and total in one RepeatableRead snapshot', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'check-in-id',
        checkedInAt: new Date('2026-11-11T16:00:00.000Z'),
        membershipStatus: CheckInMembershipStatus.VIGENTE,
        expiredConfirmed: false,
        member: {
          email: 'member@example.test',
          memberProfile: { memberNumber: 'M-1' },
          profile: { fullName: 'Member' },
        },
      },
    ]);
    const count = vi.fn().mockResolvedValue(1);
    const tx = { checkIn: { findMany, count } };
    const prisma = {
      $transaction: vi.fn(
        async (work: (client: unknown) => unknown, options: unknown) => {
          expect(options).toEqual({
            isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
          });
          return work(tx);
        },
      ),
    };
    const repository = new CheckInHistoryRepository(prisma as never);

    const page = await repository.paginate({
      from: new Date('2026-11-11T00:00:00.000Z'),
      to: new Date('2026-11-11T00:00:00.000Z'),
      skip: 0,
      take: 20,
    });

    expect(page.total).toBe(1);
    expect(page.rows).toHaveLength(1);
    expect(findMany).toHaveBeenCalledOnce();
    expect(count).toHaveBeenCalledOnce();
  });
});
