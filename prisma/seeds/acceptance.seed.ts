import { demoEmails, localAt, shiftDate, type SeedContext } from './context.js';

/**
 * Adds realistic, synthetic cross-module records for the deployed/local demo.
 * The HTTP contract suite opts out via HTTP_TEST_RUN because its baseline
 * assertions intentionally verify empty states before exercising each flow.
 */
export async function seedAcceptanceFixtures(ctx: SeedContext): Promise<void> {
  const db = ctx.prisma;
  const admin = await db.user.findUniqueOrThrow({
    where: { email: demoEmails.admin },
  });
  const trainer = await db.user.findUniqueOrThrow({
    where: { email: demoEmails.trainer1 },
  });
  const template = await db.classTemplate.findFirstOrThrow({
    where: {
      name: 'Clase funcional de prueba',
      trainerId: trainer.id,
    },
  });

  // The core seed already supplies monthly and class-credit plans.
  await db.membershipPlan.upsert({
    where: { name: 'Trimestral de prueba' },
    update: { durationMonths: 3, status: 'ACTIVO' },
    create: {
      name: 'Trimestral de prueba',
      type: 'QUARTERLY',
      priceUsd: 80,
      durationMonths: 3,
      benefits: ['Acceso al gimnasio', 'Clases grupales'],
      status: 'ACTIVO',
    },
  });

  const members = await Promise.all(
    [demoEmails.member1, demoEmails.member2, demoEmails.member3].map((email) =>
      db.user.findUniqueOrThrow({ where: { email } }),
    ),
  );
  const memberships = await Promise.all(
    members.map(async (member) => {
      const membership = await db.membership.findFirst({
        where: { memberId: member.id, status: 'VIGENTE' },
        orderBy: { startsOn: 'desc' },
      });
      if (!membership)
        throw new Error(`Falta membresía vigente para ${member.email}.`);
      return membership;
    }),
  );

  const ensureClassSession = async (
    dayOffset: number,
    status: 'PROGRAMADA' | 'COMPLETADA',
  ) => {
    const date = shiftDate(ctx.today, dayOffset);
    const startsAt = localAt(date, '10:00');
    const endsAt = localAt(date, '11:00');
    return db.classSession.upsert({
      where: {
        classTemplateId_startsAt: {
          classTemplateId: template.id,
          startsAt,
        },
      },
      update: {
        status,
        completedAt: status === 'COMPLETADA' ? endsAt : null,
        completedById: status === 'COMPLETADA' ? trainer.id : null,
      },
      create: {
        classTemplateId: template.id,
        trainerId: trainer.id,
        roomId: template.roomId,
        startsAt,
        endsAt,
        capacity: template.capacity,
        status,
        completedAt: status === 'COMPLETADA' ? endsAt : null,
        completedById: status === 'COMPLETADA' ? trainer.id : null,
      },
    });
  };

  const pastForReview = await ensureClassSession(-7, 'COMPLETADA');
  const pastEligible = await ensureClassSession(-5, 'COMPLETADA');
  const futureForTwo = await ensureClassSession(2, 'PROGRAMADA');
  const futureForThree = await ensureClassSession(3, 'PROGRAMADA');

  const ensureReservation = async (
    sessionId: string,
    memberIndex: number,
    attendance: 'PENDIENTE' | 'ASISTIO',
    consumesCredit = false,
  ) => {
    const member = members[memberIndex]!;
    const membership = memberships[memberIndex]!;
    const completed = attendance === 'ASISTIO';
    return db.classReservation.upsert({
      where: { sessionId_memberId: { sessionId, memberId: member.id } },
      update: {
        membershipId: membership.id,
        status: 'CONFIRMADA',
        attendance,
        creditConsumed: consumesCredit,
        attendanceUpdatedAt: completed ? new Date() : null,
        attendanceUpdatedById: completed ? trainer.id : null,
      },
      create: {
        sessionId,
        memberId: member.id,
        membershipId: membership.id,
        status: 'CONFIRMADA',
        attendance,
        creditConsumed: consumesCredit,
        attendanceUpdatedAt: completed ? new Date() : null,
        attendanceUpdatedById: completed ? trainer.id : null,
      },
    });
  };

  // Historical attendance supports reports and at least one member rating flow.
  const reviewedReservation = await ensureReservation(
    pastForReview.id,
    0,
    'ASISTIO',
  );
  await ensureReservation(pastEligible.id, 2, 'ASISTIO');

  // Future reservations are spread across sessions so each member can inspect
  // their own booking while capacity remains available for manual exploration.
  const reservations = [
    await ensureReservation(futureForTwo.id, 0, 'PENDIENTE'),
    await ensureReservation(futureForTwo.id, 1, 'PENDIENTE', true),
    await ensureReservation(futureForThree.id, 2, 'PENDIENTE'),
  ];
  if (memberships[1]!.creditsRemaining !== null)
    await db.membership.update({
      where: { id: memberships[1]!.id },
      data: { creditsRemaining: 9 },
    });

  const existingReview = await db.review.findFirst({
    where: { sessionId: pastForReview.id, memberId: members[0]!.id },
  });
  if (!existingReview)
    await db.review.create({
      data: {
        sessionId: pastForReview.id,
        memberId: members[0]!.id,
        rating: 5,
        comment: 'Sesión de prueba completada.',
      },
    });
  // Member three has a completed attended class with no review yet.
  void reviewedReservation;

  // Access history for all three members, recorded by the demo administrator.
  const checkInDate = new Date(`${ctx.today}T00:00:00.000Z`);
  for (const member of members) {
    const alreadyCheckedIn = await db.checkIn.findFirst({
      where: { memberId: member.id, checkInDate },
    });
    if (!alreadyCheckedIn)
      await db.checkIn.create({
        data: {
          memberId: member.id,
          checkedInAt: localAt(ctx.today, '08:30'),
          checkInDate,
          membershipStatus: 'VIGENTE',
          registeredById: admin.id,
        },
      });
  }

  // A pending personal-session payment gives the member and reception screens
  // a safe, non-card test case. No real payment provider is contacted.
  const personalStart = localAt(shiftDate(ctx.today, 2), '13:00');
  const personalEnd = localAt(shiftDate(ctx.today, 2), '14:00');
  const member = members[0]!;
  const gatewayRef = `seed-demo-personal-${member.id}-${ctx.today}`;
  let personalPayment = await db.payment.findFirst({
    where: { gatewayRef, memberId: member.id },
  });
  if (!personalPayment)
    personalPayment = await db.payment.create({
      data: {
        memberId: member.id,
        concept: 'SESION_PERSONAL',
        amountUsd: 25,
        status: 'PENDIENTE',
        dueDate: personalStart,
        gatewayRef,
      },
    });
  const personalSlot = await db.trainerSlot.upsert({
    where: {
      trainerId_startsAt: { trainerId: trainer.id, startsAt: personalStart },
    },
    update: { endsAt: personalEnd, status: 'RESERVADO' },
    create: {
      trainerId: trainer.id,
      startsAt: personalStart,
      endsAt: personalEnd,
      status: 'RESERVADO',
    },
  });
  const existingPersonalSession = await db.personalSession.findFirst({
    where: { slotId: personalSlot.id, status: 'CONFIRMADA' },
  });
  if (!existingPersonalSession)
    await db.personalSession.create({
      data: {
        slotId: personalSlot.id,
        trainerId: trainer.id,
        memberId: member.id,
        startsAt: personalStart,
        endsAt: personalEnd,
        status: 'CONFIRMADA',
        attendance: 'PENDIENTE',
        paymentId: personalPayment.id,
      },
    });

  // Assign one current routine and two dated progress snapshots per member.
  const exerciseNames = ['Sentadilla', 'Press de banca', 'Remo'];
  const exercises = await db.exercise.findMany({
    where: { name: { in: exerciseNames } },
  });
  const exerciseByName = new Map(
    exercises.map((exercise) => [exercise.name, exercise]),
  );
  for (let index = 0; index < members.length; index++) {
    const currentRoutine = await db.trainingRoutine.findFirst({
      where: { memberId: members[index]!.id, status: 'VIGENTE' },
    });
    if (!currentRoutine) {
      await db.trainingRoutine.create({
        data: {
          memberId: members[index]!.id,
          trainerId:
            index === 2
              ? (
                  await db.user.findUniqueOrThrow({
                    where: { email: demoEmails.trainer2 },
                  })
                ).id
              : trainer.id,
          name: 'Rutina base de prueba',
          goal: 'Mejorar fuerza y condición física.',
          version: 1,
          startsOn: new Date(`${shiftDate(ctx.today, -1)}T00:00:00.000Z`),
          endsOn: new Date(`${shiftDate(ctx.today, 30)}T00:00:00.000Z`),
          status: 'VIGENTE',
          exercises: {
            create: [
              {
                exerciseId: exerciseByName.get('Sentadilla')!.id,
                weekday: 1,
                sets: 3,
                reps: 10,
                position: 1,
              },
              {
                exerciseId: exerciseByName.get('Press de banca')!.id,
                weekday: 1,
                sets: 3,
                reps: 8,
                position: 2,
              },
              {
                exerciseId: exerciseByName.get('Remo')!.id,
                weekday: 3,
                sets: 3,
                reps: 12,
                position: 1,
              },
            ],
          },
        },
      });
    }

    for (const [offset, weight] of [
      [-14, 72.5 - index],
      [-7, 72 - index],
    ] as const) {
      const recordDate = new Date(
        `${shiftDate(ctx.today, offset)}T00:00:00.000Z`,
      );
      const existingRecord = await db.progressRecord.findFirst({
        where: { memberId: members[index]!.id, recordDate },
      });
      if (!existingRecord)
        await db.progressRecord.create({
          data: {
            memberId: members[index]!.id,
            recordDate,
            weightKg: weight,
            waistCm: 86 - index,
            marks: {
              create: [
                {
                  exerciseId: exerciseByName.get('Sentadilla')!.id,
                  weightKg: 40 + index * 5,
                  reps: 10,
                },
                {
                  exerciseId: exerciseByName.get('Press de banca')!.id,
                  weightKg: 25 + index * 5,
                  reps: 8,
                },
              ],
            },
          },
        });
    }
  }

  // One deduplicated reservation notification per member, for their next class.
  const memberReservations = [
    reservations[0]!,
    reservations[1]!,
    reservations[2]!,
  ];
  for (let index = 0; index < members.length; index++) {
    const dedupeKey = `seed-demo-reserva-${members[index]!.id}-${ctx.today}`;
    const exists = await db.notification.findFirst({
      where: { memberId: members[index]!.id, dedupeKey },
    });
    if (!exists)
      await db.notification.create({
        data: {
          memberId: members[index]!.id,
          module: 'RESERVAS',
          title: 'Reserva de clase confirmada',
          message:
            'Tu reserva para la clase funcional de prueba está confirmada.',
          referenceId: memberReservations[index]!.id,
          dedupeKey,
          status: 'NO_LEIDA',
        },
      });
  }
}
