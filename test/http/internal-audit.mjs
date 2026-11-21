import path from 'node:path';
import { mkdirSync } from 'node:fs';
const workDir = process.env.HTTP_RESULTS_DIR;
if (!workDir || process.env.HTTP_TEST_RUN !== 'true')
  throw new Error('Usa npm run test:http; esta batería exige base desechable.');
mkdirSync(workDir, { recursive: true });
const INTERNAL_PORT = Number(process.env.HTTP_TEST_PORT) + 1;
const INTERNAL_ORIGIN = 'http://127.0.0.1:' + INTERNAL_PORT;
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createApplication } from '../../dist/bootstrap.js';
import { PrismaService } from '../../dist/prisma/services/prisma.service.js';
import {
  NotificationService,
  NotificationValidationError,
} from '../../dist/notifications/services/notification.service.js';
import { MembershipExpiryNoticeScheduler } from '../../dist/notifications/services/membership-expiry-notice.scheduler.service.js';
import { MembershipsService } from '../../dist/memberships/services/memberships.service.js';
const app = await createApplication();
await app.listen(INTERNAL_PORT, '127.0.0.1');
const db = app.get(PrismaService),
  notices = app.get(NotificationService),
  scheduler = app.get(MembershipExpiryNoticeScheduler),
  memberships = app.get(MembershipsService),
  tests = [];
function check(name, ok, detail = {}) {
  tests.push({ name, ok, ...detail });
  console.log(
    (ok ? 'PASS' : 'FAIL') +
      ' ' +
      name +
      ' ' +
      (ok ? '' : JSON.stringify(detail).slice(0, 400)),
  );
}
async function section(name, fn) {
  try {
    await fn();
  } catch (e) {
    check('BLOCK ' + name, false, { error: e.message, stack: e.stack });
  }
}
async function expectError(name, fn, code) {
  try {
    await fn();
    check(name, false, { error: 'Aceptó entrada inválida' });
  } catch (e) {
    check(
      name,
      e instanceof NotificationValidationError &&
        e.code === code &&
        typeof e.field === 'string',
      { code: e.code, error: e.message },
    );
  }
}
const date = (n = 0) =>
  new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', {
    timeZone: 'America/El_Salvador',
  });
const m = await db.user.findUnique({ where: { email: 'miembro1@gkds.test' } }),
  t = await db.user.findUnique({ where: { email: 'entrenador1@gkds.test' } });
try {
  await section('H35 servicio compartido', async () => {
    const input = {
      memberIds: [m.id, m.id],
      module: 'SISTEMA',
      title: 'Aviso interno de auditoría',
      message: 'Mensaje de prueba del servicio interno',
      dedupeKey: 'AUDIT-TEST',
    };
    const first = await notices.send(input);
    check(
      'Envío deduplica destinatarios e incluye ids',
      first.created === 1 && first.skipped === 0 && first.ids.length === 1,
      { first },
    );
    const retry = await notices.send(input);
    check(
      'Envío deduplica reintento',
      retry.created === 0 && retry.skipped === 1 && retry.ids.length === 0,
      { retry },
    );
    await expectError(
      'Sin destinatarios',
      () => notices.send({ ...input, memberIds: [] }),
      'NO_RECIPIENTS',
    );
    await expectError(
      'Destinatario inexistente',
      () => notices.send({ ...input, memberIds: [randomUUID()] }),
      'UNKNOWN_RECIPIENT',
    );
    await expectError(
      'Entrenador no destinatario de H35',
      () => notices.send({ ...input, memberIds: [t.id] }),
      'UNKNOWN_RECIPIENT',
    );
    await expectError(
      'Módulo inválido',
      () => notices.send({ ...input, module: 'INVALIDO' }),
      'MODULE_INVALID',
    );
    await expectError(
      'Título vacío',
      () => notices.send({ ...input, title: '  ' }),
      'TITLE_INVALID',
    );
    await expectError(
      'Título largo',
      () => notices.send({ ...input, title: 'x'.repeat(101) }),
      'TITLE_INVALID',
    );
    await expectError(
      'Mensaje vacío',
      () => notices.send({ ...input, message: '' }),
      'MESSAGE_INVALID',
    );
    await expectError(
      'Mensaje largo',
      () => notices.send({ ...input, message: 'x'.repeat(501) }),
      'MESSAGE_INVALID',
    );
    try {
      await db.$transaction(async (tx) => {
        await notices.send({ ...input, dedupeKey: 'AUDIT-ROLLBACK' }, tx);
        throw new Error('rollback intencional');
      });
    } catch {}
    check(
      'Aviso respeta rollback de su módulo',
      (await db.notification.count({
        where: { dedupeKey: 'AUDIT-ROLLBACK' },
      })) === 0,
    );
    await notices
      .send({
        ...input,
        memberIds: [m.id, randomUUID()],
        dedupeKey: 'AUDIT-MULTI',
      })
      .catch(() => {});
    check(
      'Destinatario inválido evita inserción parcial',
      (await db.notification.count({ where: { dedupeKey: 'AUDIT-MULTI' } })) ===
        0,
    );
  });
  await section('H31 vencimiento', async () => {
    const plan = await db.membershipPlan.findFirst({
        where: { type: 'MONTHLY', status: 'ACTIVO' },
      }),
      fixtures = [];
    for (const days of [1, 7, 5]) {
      const u = await db.user.create({
        data: {
          email: `vencimiento${days}@audit.test`,
          passwordHash: m.passwordHash,
          role: 'MIEMBRO',
          profile: { create: { fullName: `Miembro aviso ${days}` } },
        },
      });
      const p = await db.payment.create({
        data: {
          memberId: u.id,
          concept: 'MEMBRESIA',
          amountUsd: 30,
          status: 'PAGADO',
          method: 'EFECTIVO',
          paidAt: new Date(),
          dueDate: new Date(),
        },
      });
      const membership = await db.membership.create({
        data: {
          memberId: u.id,
          planId: plan.id,
          paymentId: p.id,
          startsOn: new Date(date(-10) + 'T00:00Z'),
          endsOn: new Date(date(days) + 'T00:00Z'),
          status: 'VIGENTE',
        },
      });
      fixtures.push({ u, membership, days });
    }
    await scheduler.run(new Date());
    const second = await scheduler.run(new Date());
    for (const f of fixtures)
      check(
        'Aviso umbral ' + f.days + ' días',
        (await db.notification.count({
          where: { memberId: f.u.id, module: 'MEMBRESIAS' },
        })) === ([1, 7].includes(f.days) ? 1 : 0),
      );
    check('Reejecutar scheduler no duplica', second === 0, { second });
    const f = fixtures.find((x) => x.days === 7);
    await db.notification.deleteMany({ where: { memberId: f.u.id } });
    const newer = await db.payment.create({
      data: {
        memberId: f.u.id,
        concept: 'MEMBRESIA',
        amountUsd: 30,
        status: 'PAGADO',
        method: 'EFECTIVO',
        paidAt: new Date(),
        dueDate: new Date(),
      },
    });
    await db.membership.create({
      data: {
        memberId: f.u.id,
        planId: plan.id,
        paymentId: newer.id,
        startsOn: new Date(date(8) + 'T00:00Z'),
        endsOn: new Date(date(38) + 'T00:00Z'),
        status: 'VIGENTE',
      },
    });
    await scheduler.run(new Date());
    check(
      'Renovación pagada suprime aviso',
      (await db.notification.count({
        where: { memberId: f.u.id, module: 'MEMBRESIAS' },
      })) === 0,
    );
    const expired = fixtures.find((x) => x.days === 5);
    await db.membership.update({
      where: { id: expired.membership.id },
      data: { endsOn: new Date(date(-1) + 'T00:00Z') },
    });
    await memberships.expireOverdue();
    check(
      'Job vence membresía atrasada',
      (await db.membership.findUnique({ where: { id: expired.membership.id } }))
        .status === 'VENCIDA',
    );
    const by = await db.membershipPlan.findFirst({
      where: { type: 'BY_CLASSES', status: 'ACTIVO' },
    });
    const u = await db.user.create({
        data: {
          email: 'creditosagotados@audit.test',
          passwordHash: m.passwordHash,
          role: 'MIEMBRO',
        },
      }),
      p = await db.payment.create({
        data: {
          memberId: u.id,
          concept: 'MEMBRESIA',
          amountUsd: 30,
          status: 'PAGADO',
          method: 'EFECTIVO',
          paidAt: new Date(),
          dueDate: new Date(),
        },
      });
    await db.membership.create({
      data: {
        memberId: u.id,
        planId: by.id,
        paymentId: p.id,
        startsOn: new Date(date(-10) + 'T00:00Z'),
        endsOn: new Date(date(7) + 'T00:00Z'),
        status: 'VENCIDA',
        creditsRemaining: 0,
      },
    });
    await scheduler.run(new Date());
    check(
      'H31 no notifica créditos agotados',
      (await db.notification.count({ where: { memberId: u.id } })) === 0,
    );
  });
  await section('Rollback HTTP pago y aviso', async () => {
    const login = await fetch(INTERNAL_ORIGIN + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@gkds.test',
          password: process.env.SEED_PASSWORD,
        }),
      }),
      token = (await login.json()).accessToken;
    const p = await db.payment.create({
        data: {
          memberId: m.id,
          concept: 'SESION_ADICIONAL',
          amountUsd: 10,
          status: 'PENDIENTE',
          dueDate: new Date(),
        },
      }),
      original = notices.send.bind(notices);
    notices.send = async () => {
      throw new NotificationValidationError(
        'MODULE_INVALID',
        'Fallo de validación inyectado para rollback',
        'module',
      );
    };
    try {
      const r = await fetch(`${INTERNAL_ORIGIN}/api/payments/${p.id}/collect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
          },
          body: JSON.stringify({ method: 'EFECTIVO' }),
        }),
        body = await r.json();
      check(
        'Error H35 se traduce a 400',
        r.status === 400 && body.code === 'MODULE_INVALID',
        {
          method: 'POST',
          path: `/api/payments/${p.id}/collect`,
          status: r.status,
          expected: 400,
          body,
        },
      );
    } finally {
      notices.send = original;
    }
    check(
      'Fallo de aviso revierte pago',
      (await db.payment.findUnique({ where: { id: p.id } })).status ===
        'PENDIENTE',
    );
    check(
      'Fallo de aviso revierte comprobante',
      (await db.receipt.count({ where: { paymentId: p.id } })) === 0,
    );
    check(
      'No se crean eventos de cola en flujos nuevos',
      (await db.domainEvent.count()) === 0,
    );
  });
} finally {
  await app.close();
  fs.writeFileSync(
    path.join(workDir, 'internal-results.json'),
    JSON.stringify(
      {
        total: tests.length,
        passed: tests.filter((x) => x.ok).length,
        failed: tests.filter((x) => !x.ok).length,
        results: tests,
      },
      null,
      2,
    ),
  );
  console.log(
    'SUMMARY',
    tests.length,
    tests.filter((x) => x.ok).length,
    tests.filter((x) => !x.ok).length,
  );
}
