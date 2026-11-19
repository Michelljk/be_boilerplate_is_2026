import { demoEmails, type SeedContext } from './context.js';
export async function seedH22(ctx: SeedContext): Promise<void> {
  const trainer1 = await ctx.prisma.user.findUniqueOrThrow({
    where: { email: demoEmails.trainer1 },
  });
  const trainer2 = await ctx.prisma.user.findUniqueOrThrow({
    where: { email: demoEmails.trainer2 },
  });
  for (const [email, trainer] of [
    [demoEmails.member1, trainer1],
    [demoEmails.member2, trainer1],
    [demoEmails.member3, trainer2],
  ] as const) {
    const member = await ctx.prisma.user.findUniqueOrThrow({
      where: { email },
    });
    if (
      !(await ctx.prisma.trainerMemberAssignment.findFirst({
        where: { memberId: member.id, status: 'ACTIVA' },
      }))
    )
      await ctx.prisma.trainerMemberAssignment.create({
        data: { memberId: member.id, trainerId: trainer.id, status: 'ACTIVA' },
      });
  }
  for (const [name, muscleGroup] of [
    ['Sentadilla', 'Piernas'],
    ['Press de banca', 'Pecho'],
    ['Peso muerto', 'Cadena posterior'],
    ['Remo', 'Espalda'],
    ['Plancha', 'Abdomen'],
  ] as const)
    await ctx.prisma.exercise.upsert({
      where: { name },
      update: {},
      create: { name, muscleGroup, isActive: true },
    });
}
