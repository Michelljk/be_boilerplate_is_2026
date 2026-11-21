import { demoEmails, shiftDate, type SeedContext } from './context.js';
export async function seedH40(ctx: SeedContext): Promise<void> {
  const accounts = [
    [demoEmails.admin, 'Administración de prueba', 'RECEPCION_ADMIN'],
    [demoEmails.trainer1, 'Entrenador Uno', 'ENTRENADOR'],
    [demoEmails.trainer2, 'Entrenadora Dos', 'ENTRENADOR'],
    [demoEmails.member1, 'Miembro Uno', 'MIEMBRO'],
    [demoEmails.member2, 'Miembro Dos', 'MIEMBRO'],
    [demoEmails.member3, 'Miembro Tres', 'MIEMBRO'],
  ] as const;
  for (const [email, fullName, role] of accounts) {
    const user = await ctx.prisma.user.upsert({
      where: { email },
      // Rerunning the demo seed deliberately restores the configured password
      // for these synthetic accounts without changing their existing profiles.
      update: { passwordHash: ctx.passwordHash },
      create: {
        email,
        role,
        passwordHash: ctx.passwordHash,
        profile: { create: { fullName } },
      },
    });
    if (
      role === 'MIEMBRO' &&
      !(await ctx.prisma.memberProfile.findUnique({
        where: { userId: user.id },
      }))
    ) {
      const [{ value }] = await ctx.prisma.$queryRaw<
        { value: bigint }[]
      >`SELECT nextval('member_number_seq') AS value`;
      await ctx.prisma.memberProfile.create({
        data: {
          userId: user.id,
          memberNumber: `M-${String(value).padStart(6, '0')}`,
        },
      });
    }
  }
  const monthly = await ctx.prisma.membershipPlan.upsert({
    where: { name: 'Mensual de prueba' },
    // H3 exige que un plan MONTHLY dure exactamente 1 mes: sin este dato la
    // renovación (H2) rechazaba el plan sembrado.
    update: { durationMonths: 1 },
    create: {
      name: 'Mensual de prueba',
      type: 'MONTHLY',
      priceUsd: 30,
      durationMonths: 1,
      benefits: ['Clases grupales'],
      status: 'ACTIVO',
    },
  });
  const byClasses = await ctx.prisma.membershipPlan.upsert({
    where: { name: 'Por clases de prueba' },
    update: {},
    create: {
      name: 'Por clases de prueba',
      type: 'BY_CLASSES',
      priceUsd: 20,
      credits: 10,
      durationDays: 30,
      benefits: ['Diez clases'],
      status: 'ACTIVO',
    },
  });
  for (const [email, plan, credits] of [
    [demoEmails.member1, monthly, null],
    [demoEmails.member2, byClasses, 10],
    [demoEmails.member3, monthly, null],
  ] as const) {
    const member = await ctx.prisma.user.findUniqueOrThrow({
      where: { email },
    });
    const reference = `seed-membership-${member.id}-${ctx.today}`;
    let payment = await ctx.prisma.payment.findFirst({
      where: { gatewayRef: reference, memberId: member.id },
    });
    if (!payment)
      payment = await ctx.prisma.payment.create({
        data: {
          memberId: member.id,
          concept: 'MEMBRESIA',
          amountUsd: plan.priceUsd,
          status: 'PAGADO',
          method: 'EFECTIVO',
          paidAt: new Date(),
          dueDate: new Date(),
          gatewayRef: reference,
        },
      });
    await ctx.prisma.receipt.upsert({
      where: { paymentId: payment.id },
      update: {},
      create: {
        paymentId: payment.id,
        method: payment.method ?? 'EFECTIVO',
        issuedAt: payment.paidAt ?? new Date(),
      },
    });
    // El seed cubre desde ayer hasta dentro de 30 días, así que la membresa
    // sembrada está VIGENTE; se calcula igual que la regla del backend para que
    // la columna `status` que lee H1 no quede inventada.
    const startsOn = new Date(`${shiftDate(ctx.today, -1)}T00:00:00Z`);
    const endsOn = new Date(`${shiftDate(ctx.today, 30)}T00:00:00Z`);
    const today = new Date(`${ctx.today}T00:00:00Z`);
    const exhausted = plan.type === 'BY_CLASSES' && credits === 0;
    const status = endsOn >= today && !exhausted ? 'VIGENTE' : 'VENCIDA';
    await ctx.prisma.membership.upsert({
      where: { paymentId: payment.id },
      update: {},
      create: {
        memberId: member.id,
        planId: plan.id,
        paymentId: payment.id,
        startsOn,
        endsOn,
        creditsRemaining: credits,
        status,
      },
    });
  }
}
