import { demoEmails, shiftDate, localAt, type SeedContext } from './context.js';
export async function seedH9(ctx: SeedContext): Promise<void> {
  const trainer = await ctx.prisma.user.findUniqueOrThrow({
    where: { email: demoEmails.trainer1 },
  });
  const date = shiftDate(ctx.today, 1);
  const startsAt = localAt(date, '06:00');
  await ctx.prisma.trainerSlot.upsert({
    where: { trainerId_startsAt: { trainerId: trainer.id, startsAt } },
    update: {},
    create: {
      trainerId: trainer.id,
      startsAt,
      endsAt: localAt(date, '07:00'),
      status: 'LIBRE',
    },
  });
}
