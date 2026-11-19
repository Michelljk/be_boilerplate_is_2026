import { describe, expect, it, vi } from 'vitest';
import { MembershipExpiryNoticeScheduler } from './membership-expiry-notice.scheduler.service.js';

const MEMBERSHIP_ID = '22222222-2222-4222-8222-222222222222';
const MEMBER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function setup() {
  const prisma = {
    $queryRaw: vi.fn().mockResolvedValue([
      {
        membershipId: MEMBERSHIP_ID,
        memberId: MEMBER_ID,
        planName: 'Paquete de clases',
        endsOn: '2026-11-26',
        daysLeft: 7,
      },
    ]),
  };
  const notifications = {
    send: vi
      .fn()
      .mockResolvedValue({ created: 1, skipped: 0, ids: ['notice-id'] }),
  };
  return {
    scheduler: new MembershipExpiryNoticeScheduler(
      prisma as never,
      notifications as never,
    ),
    prisma,
    notifications,
  };
}

describe('MembershipExpiryNoticeScheduler (H31)', () => {
  it('incluye plan BY_CLASSES con cero créditos y conserva filtros y dedupe', async () => {
    const { scheduler, prisma, notifications } = setup();

    await expect(
      scheduler.run(new Date('2026-11-19T12:00:00.000Z')),
    ).resolves.toBe(1);

    const query = prisma.$queryRaw.mock.calls[0][0] as { sql: string };
    const sql = query.sql;
    expect(sql).not.toContain('credits_remaining');
    expect(sql).toContain('pay.status');
    expect(sql).toContain('pay.concept');
    expect(sql).toContain('m.status');
    expect(sql).toContain('starts_on');
    expect(sql).toContain('ends_on');
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain('newer.starts_on > m.starts_on');

    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({
        memberIds: [MEMBER_ID],
        module: 'MEMBRESIAS',
        referenceId: MEMBERSHIP_ID,
        dedupeKey: `VENC-${MEMBERSHIP_ID}-7`,
      }),
    );
  });
});
