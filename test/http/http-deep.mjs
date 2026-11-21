import path from 'node:path';
import { mkdirSync } from 'node:fs';
const workDir = process.env.HTTP_RESULTS_DIR;
if (!workDir || process.env.HTTP_TEST_RUN !== 'true')
  throw new Error('Usa npm run test:http; esta batería exige base desechable.');
mkdirSync(workDir, { recursive: true });
const API_ORIGIN = process.env.HTTP_API_ORIGIN;
const API_BASE = API_ORIGIN + '/api';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require = createRequire(new URL('../../package.json', import.meta.url)),
  { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const tests = [],
  tokens = {},
  users = {};
const base = API_BASE;
const day = (n = 0) =>
  new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', {
    timeZone: 'America/El_Salvador',
  });
const _local = (n, h) =>
  day(n) + 'T' + String(h).padStart(2, '0') + ':00:00-06:00';
const card = {
  cardNumber: '1111222233331234',
  holder: 'Titular de prueba',
  expiry: '12/30',
  cvv: '123',
};
function check(name, ok, detail = {}) {
  tests.push({ name, ok, ...detail });
  console.log(
    (ok ? 'PASS' : 'FAIL') +
      ' ' +
      name +
      ' ' +
      (ok ? '' : JSON.stringify(detail).slice(0, 650)),
  );
}
async function sql(s, a = []) {
  return (await db.query(s, a)).rows;
}
async function req(name, method, path, role, body, expected, assert) {
  const start = performance.now();
  const r = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(role ? { Authorization: 'Bearer ' + tokens[role] } : {}),
    },
    ...(method === 'GET' || body === undefined
      ? {}
      : { body: JSON.stringify(body) }),
  });
  const bytes = Buffer.from(await r.arrayBuffer());
  let data;
  try {
    data = JSON.parse(bytes.toString());
  } catch {
    data = bytes.toString('latin1');
  }
  check(
    name,
    (Array.isArray(expected) ? expected : [expected]).includes(r.status),
    {
      method,
      path,
      role,
      status: r.status,
      expected,
      body: data,
      elapsedMs: Math.round(performance.now() - start),
    },
  );
  if (assert) check(name + ' [datos]', assert(data), { body: data });
  return { data, status: r.status, bytes };
}
async function section(name, fn) {
  console.log('\n### ' + name);
  try {
    await fn();
  } catch (e) {
    check('BLOCK ' + name, false, { error: e.message, stack: e.stack });
  }
}
async function pending(memberId, amount = '10.00') {
  const id = randomUUID();
  await sql(
    "INSERT INTO payments(id,member_id,concept,amount_usd,status,due_date,created_at,updated_at)VALUES($1,$2,'SESION_ADICIONAL',$3,'PENDIENTE',now(),now(),now())",
    [id, memberId, amount],
  );
  return id;
}
try {
  for (const [k, n] of [
    ['a', 'admin'],
    ['t', 'entrenador1'],
    ['t2', 'entrenador2'],
    ['m', 'miembro1'],
    ['m2', 'miembro2'],
  ]) {
    const r = await req(
      'Login profundidad ' + k,
      'POST',
      '/auth/login',
      null,
      { email: n + '@gkds.test', password: process.env.SEED_PASSWORD },
      200,
    );
    tokens[k] = r.data.accessToken;
    users[k] = r.data.user;
  }
  await section('Administración nuevas consultas', async () => {
    const all = await req(
      'Sesiones admin listado nuevo',
      'GET',
      '/admin/class-sessions?pageSize=50',
      'a',
      undefined,
      200,
      (d) => Array.isArray(d.data) && Number.isInteger(d.total),
    );
    const sid = all.data.data[0].id;
    await req(
      'Sesión admin detalle nuevo',
      'GET',
      `/admin/class-sessions/${sid}`,
      'a',
      undefined,
      200,
      (d) => d.id === sid,
    );
    await req(
      'Sesión admin inexistente',
      'GET',
      `/admin/class-sessions/${randomUUID()}`,
      'a',
      undefined,
      404,
    );
    await req(
      'Sesión admin UUID inválido',
      'GET',
      '/admin/class-sessions/no-uuid',
      'a',
      undefined,
      400,
    );
    for (const query of [
      'page=0',
      'pageSize=51',
      'status=INVALID',
      'from=2026-02-30',
      'from=2026-12-01&to=2026-11-01',
      'unknown=true',
    ])
      await req(
        'Sesiones admin query inválida ' + query,
        'GET',
        '/admin/class-sessions?' + query,
        'a',
        undefined,
        400,
      );
    await req(
      'Sesiones admin filtro canceladas',
      'GET',
      '/admin/class-sessions?status=CANCELADA',
      'a',
      undefined,
      200,
      (d) => d.data.every((x) => x.status === 'CANCELADA'),
    );
    const mc = (
      await sql(
        'SELECT machine_id FROM machine_maintenances WHERE ended_at IS NOT NULL LIMIT 1',
      )
    )[0];
    const count = (
      await sql(
        'SELECT count(*)::int n FROM machine_maintenances WHERE machine_id=$1',
        [mc.machine_id],
      )
    )[0].n;
    await req(
      'Mantenimientos historial nuevo',
      'GET',
      `/machines/${mc.machine_id}/maintenance`,
      'a',
      undefined,
      200,
      (d) => d.total === count && d.data.some((x) => x.endedAt !== null),
    );
    await req(
      'Mantenimientos openOnly true',
      'GET',
      `/machines/${mc.machine_id}/maintenance?openOnly=true`,
      'a',
      undefined,
      200,
      (d) => d.data.every((x) => x.endedAt === null),
    );
    await req(
      'Mantenimientos openOnly false conserva cerrados',
      'GET',
      `/machines/${mc.machine_id}/maintenance?openOnly=false`,
      'a',
      undefined,
      200,
      (d) => d.total === count && d.data.some((x) => x.endedAt !== null),
    );
    await req(
      'Mantenimientos openOnly inválido',
      'GET',
      `/machines/${mc.machine_id}/maintenance?openOnly=basura`,
      'a',
      undefined,
      400,
    );
    await req(
      'Mantenimientos máquina inexistente',
      'GET',
      `/machines/${randomUUID()}/maintenance`,
      'a',
      undefined,
      404,
    );
    await req(
      'Mantenimientos UUID inválido',
      'GET',
      '/machines/no-uuid/maintenance',
      'a',
      undefined,
      400,
    );
    await req(
      'Mantenimientos paginación inválida',
      'GET',
      `/machines/${mc.machine_id}/maintenance?page=0`,
      'a',
      undefined,
      400,
    );
    await req(
      'Rutina de cliente ruta nueva',
      'GET',
      `/trainers/me/members/${users.m.id}/routines/current`,
      't',
      undefined,
      200,
      (d) => d !== null && Number.isInteger(d.version),
    );
    await req(
      'Rutina de cliente ajeno',
      'GET',
      `/trainers/me/members/${users.m.id}/routines/current`,
      't2',
      undefined,
      404,
    );
    await req(
      'Rutina cliente UUID inválido',
      'GET',
      '/trainers/me/members/no-uuid/routines/current',
      't',
      undefined,
      400,
    );
    await req(
      'Rutina cliente inexistente',
      'GET',
      `/trainers/me/members/${randomUUID()}/routines/current`,
      't',
      undefined,
      404,
    );
    await req(
      'Catálogo salas para miembro permitido',
      'GET',
      '/rooms',
      'm',
      undefined,
      200,
    );
    await req(
      'Catálogo ejercicios para miembro permitido',
      'GET',
      '/exercises',
      'm',
      undefined,
      200,
    );
    const number = (
      await sql('SELECT member_number FROM member_profiles WHERE user_id=$1', [
        users.m.id,
      ])
    )[0].member_number;
    await req(
      'Búsqueda incluye ID membresía elegible',
      'GET',
      '/access/members?q=' + number,
      'a',
      undefined,
      200,
      (d) => typeof d.data[0].membership.membershipId === 'string',
    );
  });
  await section('Ciclo anulación precio y nuevo pendiente', async () => {
    const email = 'anulacion-integral@audit.test';
    const reg = await req(
      'Registrar miembro de anulación',
      'POST',
      '/users',
      null,
      {
        email,
        fullName: 'Miembro Anulación Integral',
        password: 'AuditPass2026',
      },
      201,
    );
    const mid = reg.data.id;
    const login = await req(
      'Login miembro de anulación',
      'POST',
      '/auth/login',
      null,
      { email, password: 'AuditPass2026' },
      200,
    );
    tokens.v = login.data.accessToken;
    users.v = login.data.user;
    const plan = await req(
      'Crear plan para anulación',
      'POST',
      '/membership-plans',
      'a',
      {
        name: 'Plan anulación integral',
        type: 'MONTHLY',
        priceUsd: '25.00',
        durationMonths: 1,
        benefits: ['Auditoría integral'],
        status: 'ACTIVO',
      },
      201,
    );
    const number = (
      await sql('SELECT member_number FROM member_profiles WHERE user_id=$1', [
        mid,
      ])
    )[0].member_number;
    await req(
      'Comprar para anulación',
      'POST',
      '/memberships/purchases',
      'a',
      { memberNumber: number, planId: plan.data.id },
      201,
    );
    const paidId = (
      await sql(
        "SELECT id FROM payments WHERE member_id=$1 AND status='PENDIENTE' ORDER BY created_at DESC LIMIT 1",
        [mid],
      )
    )[0].id;
    await req(
      'Cobrar antes de anular funcional',
      'POST',
      `/payments/${paidId}/collect`,
      'a',
      { method: 'EFECTIVO' },
      [200, 201],
    );
    const mem = (
      await sql('SELECT * FROM memberships WHERE member_id=$1', [mid])
    )[0];
    const receipt = (
      await sql('SELECT id FROM receipts WHERE payment_id=$1', [paidId])
    )[0];
    await req(
      'Actualizar precio vigente',
      'PATCH',
      `/membership-plans/${plan.data.id}`,
      'a',
      { priceUsd: '40.00' },
      200,
    );
    const voided = await req(
      'Anular pago y crear pendiente',
      'PATCH',
      `/payments/${paidId}/void`,
      'a',
      { reason: 'Anulación para verificar precio y activación' },
      200,
    );
    const next = (
      await sql('SELECT * FROM payments WHERE id=$1', [
        voided.data.newPaymentId,
      ])
    )[0];
    check(
      'Nuevo pendiente usa precio vigente',
      Number(next.amount_usd) === 40,
      { amount: next.amount_usd, expected: '40.00' },
    );
    check(
      'Nuevo pendiente conserva concepto',
      next.status === 'PENDIENTE' && next.concept === 'MEMBRESIA',
      { status: next.status, concept: next.concept },
    );
    check(
      'Nuevo pendiente vence tres días después',
      new Date(next.due_date).toISOString().slice(0, 10) === day(3),
      { dueDate: next.due_date, expected: day(3) },
    );
    await req(
      'Anulación revierte estado consultado',
      'GET',
      '/memberships/me',
      'v',
      undefined,
      200,
      (d) => d.membership === null || d.membership.status === 'VENCIDA',
    );
    const persisted = (
      await sql('SELECT status FROM memberships WHERE id=$1', [mem.id])
    )[0];
    check(
      'Anulación revierte estado persistido membresía',
      persisted.status === 'VENCIDA',
      { persisted },
    );
    const pdf = await req(
      'PDF conservado después de anular',
      'GET',
      `/receipts/${receipt.id}/pdf`,
      'v',
      undefined,
      200,
    );
    fs.writeFileSync(path.join(workDir, 'receipt-voided.pdf'), pdf.bytes);
    check(
      'PDF incluye ANULADO',
      execFileSync(
        'pdftotext',
        [path.join(workDir, 'receipt-voided.pdf'), '-'],
        { encoding: 'utf8' },
      ).includes('ANULADO'),
    );
    await req(
      'Volver a cobrar pendiente creado por anulación',
      'POST',
      `/payments/${next.id}/collect`,
      'a',
      { method: 'EFECTIVO' },
      [200, 201],
    );
    await req(
      'Recobro debe restablecer membresía',
      'GET',
      '/memberships/me',
      'v',
      undefined,
      200,
      (d) => d.membership?.status === 'VIGENTE',
    );
  });
  await section('Cancelación de personal pagada', async () => {
    const slot = await req(
      'Slot para sesión pagada',
      'POST',
      '/trainer-slots',
      't2',
      { date: day(3), startTime: '09:00' },
      201,
    );
    const per = await req(
      'Sesión personal que se pagará',
      'POST',
      '/personal-sessions',
      'm',
      { slotId: slot.data.id },
      201,
    );
    const row = (
      await sql('SELECT payment_id FROM personal_sessions WHERE id=$1', [
        per.data.id,
      ])
    )[0];
    await req(
      'Pagar sesión personal funcional',
      'POST',
      `/payments/${row.payment_id}/card`,
      'm',
      card,
      [200, 201],
    );
    await req(
      'Cancelar sesión personal pagada',
      'PATCH',
      `/personal-sessions/${per.data.id}/cancel`,
      'm',
      undefined,
      200,
    );
    const pay = (
      await sql('SELECT status FROM payments WHERE id=$1', [row.payment_id])
    )[0];
    const sl = (
      await sql('SELECT status FROM trainer_slots WHERE id=$1', [slot.data.id])
    )[0];
    check(
      'Cancelación pagada no hace reembolso implícito',
      pay.status === 'PAGADO',
      { pay },
    );
    check('Cancelación pagada libera slot', sl.status === 'LIBRE', { sl });
    await req(
      'Reutilizar slot de sesión pagada cancelada',
      'POST',
      '/personal-sessions',
      'm2',
      { slotId: slot.data.id },
      201,
    );
  });
  await section('Cobros simultáneos y precedencia de errores', async () => {
    for (let n = 1; n <= 3; n++) {
      const id = await pending(users.m.id);
      const out = await Promise.all(
        [1, 2, 3].map((k) =>
          req(
            `Carrera tarjeta miembro ${n}.${k}`,
            'POST',
            `/payments/${id}/card`,
            'm',
            card,
            [200, 201, 409],
          ),
        ),
      );
      check(
        'Carrera tarjeta un recibo ' + n,
        (
          await sql(
            'SELECT count(*)::int n FROM receipts WHERE payment_id=$1',
            [id],
          )
        )[0].n === 1,
        { statuses: out.map((x) => x.status) },
      );
    }
    const own = await pending(users.m.id),
      other = await pending(users.m2.id);
    const success = await req(
      'Tarjeta válida aprobación funcional',
      'POST',
      `/payments/${own}/card`,
      'm',
      card,
      [200, 201],
    );
    check(
      'Simulación espera dos segundos',
      tests.findLast((x) => x.name === 'Tarjeta válida aprobación funcional')
        .elapsedMs >= 1800,
      {
        elapsedMs: tests.findLast(
          (x) => x.name === 'Tarjeta válida aprobación funcional',
        ).elapsedMs,
      },
    );
    check(
      'Monto USD dos decimales en pago',
      success.data.amountUsd === '10.00',
      { amountUsd: success.data.amountUsd },
    );
    await req(
      'Tarjeta rechazada pago ajeno debe 404',
      'POST',
      `/payments/${other}/card`,
      'm',
      { ...card, cardNumber: '1111222233335678' },
      404,
    );
    await req(
      'Pago pagado con tarjeta rechazada debe 409',
      'POST',
      `/payments/${own}/card`,
      'm',
      { ...card, cardNumber: '1111222233335678' },
      409,
    );
    const p = await pending(users.m.id);
    await req(
      'Recepción tarjeta 1234 válida',
      'POST',
      `/payments/${p}/collect`,
      'a',
      { method: 'TARJETA', ...card },
      200,
    );
    await req(
      'Recepción no procesa otra tarjeta sobre pago pagado',
      'POST',
      `/payments/${p}/collect`,
      'a',
      { method: 'TARJETA', ...card, cardNumber: '1111222233334242' },
      409,
    );
  });
} finally {
  await db.end();
  fs.writeFileSync(
    path.join(workDir, 'http-deep-results.json'),
    JSON.stringify(
      {
        total: tests.length,
        passed: tests.filter((t) => t.ok).length,
        failed: tests.filter((t) => !t.ok).length,
        results: tests,
      },
      null,
      2,
    ),
  );
  console.log(
    'SUMMARY',
    tests.length,
    tests.filter((t) => t.ok).length,
    tests.filter((t) => !t.ok).length,
  );
}
