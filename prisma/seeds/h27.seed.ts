import { demoEmails, localAt, type SeedContext } from './context.js';
export async function seedH27(ctx: SeedContext): Promise<void> {
  const admin = await ctx.prisma.user.findUniqueOrThrow({
    where: { email: demoEmails.admin },
  });
  for (const [name, type, location, status] of [
    ['Caminadora', 'Cardio', 'Zona cardio', 'DISPONIBLE'],
    ['Bicicleta estática', 'Cardio', 'Zona cardio', 'EN_MANTENIMIENTO'],
    ['Prensa de piernas', 'Fuerza', 'Zona fuerza', 'FUERA_SERVICIO'],
    ['Máquina de poleas', 'Fuerza', 'Zona fuerza', 'DISPONIBLE'],
  ] as const) {
    const machine = await ctx.prisma.machine.upsert({
      where: { name },
      update: {},
      create: { name, type, location, status },
    });
    // Una máquina EN_MANTENIMIENTO siempre tiene un mantenimiento abierto real y trazable.
    if (
      machine.status === 'EN_MANTENIMIENTO' &&
      !(await ctx.prisma.machineMaintenance.findFirst({
        where: { machineId: machine.id, endedAt: null },
      }))
    )
      await ctx.prisma.machineMaintenance.create({
        data: {
          machineId: machine.id,
          reason: 'Revisión preventiva de la bicicleta de prueba',
          startedAt: localAt(ctx.today, '06:00'),
          createdById: admin.id,
        },
      });
  }
}
