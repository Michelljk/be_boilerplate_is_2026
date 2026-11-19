import { demoEmails, shiftDate, localAt, type SeedContext } from './context.js';
export async function seedH4(ctx: SeedContext): Promise<void> {
  const rooms = [];
  for (const [name, capacity] of [
    ['Sala funcional', 30],
    ['Sala de spinning', 20],
    ['Sala de entrenamiento grupal', 30],
  ] as const)
    rooms.push(
      await ctx.prisma.room.upsert({
        where: { name },
        update: {},
        create: { name, capacity },
      }),
    );
  const trainer = await ctx.prisma.user.findUniqueOrThrow({
    where: { email: demoEmails.trainer1 },
  });
  const date = shiftDate(ctx.today, 1);
  const startsAt = localAt(date, '10:00');
  const endsAt = localAt(date, '11:00');
  const day = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
  let template = await ctx.prisma.classTemplate.findFirst({
    where: { name: 'Clase funcional de prueba', trainerId: trainer.id },
  });
  if (!template)
    template = await ctx.prisma.classTemplate.create({
      data: {
        name: 'Clase funcional de prueba',
        trainerId: trainer.id,
        roomId: rooms[0]!.id,
        weekday: day,
        startTime: '10:00',
        durationMinutes: 60,
        capacity: 2,
        status: 'ACTIVA',
      },
    });
  await ctx.prisma.classSession.upsert({
    where: {
      classTemplateId_startsAt: { classTemplateId: template.id, startsAt },
    },
    update: {},
    create: {
      classTemplateId: template.id,
      trainerId: trainer.id,
      roomId: rooms[0]!.id,
      startsAt,
      endsAt,
      capacity: 2,
      status: 'PROGRAMADA',
    },
  });
}
