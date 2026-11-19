import { demoEmails, shiftDate, localAt, type SeedContext } from './context.js';
export async function seedH12(ctx: SeedContext): Promise<void> {
  const trainer = await ctx.prisma.user.findUniqueOrThrow({
    where: { email: demoEmails.trainer1 },
  });
  const member = await ctx.prisma.user.findUniqueOrThrow({
    where: { email: demoEmails.member1 },
  });
  for (const day of [-1, 1]) {
    const date = shiftDate(ctx.today, day);
    const startsAt = localAt(date, '16:00');
    const endsAt = localAt(date, '17:00');
    const slot = await ctx.prisma.trainerSlot.upsert({
      where: { trainerId_startsAt: { trainerId: trainer.id, startsAt } },
      update: {},
      create: { trainerId: trainer.id, startsAt, endsAt, status: 'RESERVADO' },
    });
    await ctx.prisma.personalSession.upsert({
      where: { slotId: slot.id },
      update: {},
      create: {
        slotId: slot.id,
        trainerId: trainer.id,
        memberId: member.id,
        startsAt,
        endsAt,
        status: 'CONFIRMADA',
        attendance: 'PENDIENTE',
      },
    });
  }
}
