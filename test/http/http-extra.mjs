import path from 'node:path';
import { mkdirSync } from 'node:fs';
const workDir = process.env.HTTP_RESULTS_DIR;
if (!workDir || process.env.HTTP_TEST_RUN !== 'true')
  throw new Error('Usa npm run test:http; esta batería exige base desechable.');
mkdirSync(workDir, { recursive: true });
const API_ORIGIN = process.env.HTTP_API_ORIGIN;
const API_BASE = API_ORIGIN + '/api';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const base = API_BASE;
const tests = [];
const tokens = {},
  users = {};
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
async function q(sql, args = []) {
  return (await db.query(sql, args)).rows;
}
async function req(name, method, path, role, body, expect, assertion) {
  const headers = { 'Content-Type': 'application/json' };
  if (role) headers.Authorization = 'Bearer ' + tokens[role];
  const r = await fetch(base + path, {
    method,
    headers,
    ...(method === 'GET' || body === undefined
      ? {}
      : { body: JSON.stringify(body) }),
  });
  const bytes = Buffer.from(await r.arrayBuffer());
  let d;
  try {
    d = JSON.parse(bytes.toString());
  } catch {
    d = bytes.toString('latin1');
  }
  check(name, (Array.isArray(expect) ? expect : [expect]).includes(r.status), {
    method,
    path,
    role,
    status: r.status,
    expected: expect,
    body: d,
  });
  if (assertion) check(name + ' [datos]', assertion(d), { body: d });
  return { data: d, status: r.status, bytes, headers: r.headers };
}
const date = (n) =>
  new Date(Date.now() + (n || 0) * 86400000).toLocaleDateString('en-CA', {
    timeZone: 'America/El_Salvador',
  });
const local = (n, h) =>
  date(n) + 'T' + String(h).padStart(2, '0') + ':00:00-06:00';
const unknown = randomUUID();
async function section(name, fn) {
  console.log('\n### ' + name);
  try {
    await fn();
  } catch (e) {
    check('BLOCK ' + name, false, { error: e.message, stack: e.stack });
  }
}
try {
  for (const [key, email] of [
    ['a', 'admin'],
    ['t', 'entrenador1'],
    ['t2', 'entrenador2'],
    ['m', 'miembro1'],
    ['m2', 'miembro2'],
    ['m3', 'miembro3'],
    ['new', 'auditoria'],
  ]) {
    const r = await req(
      'Login extra ' + key,
      'POST',
      '/auth/login',
      null,
      { email: email + '@gkds.test', password: process.env.SEED_PASSWORD },
      200,
    );
    tokens[key] = r.data.accessToken;
    users[key] = r.data.user;
  }
  await section(
    'Cobros bloqueados y comprobantes mediante fixtures',
    async () => {
      const mem = (
        await q(
          'SELECT id,plan_id FROM memberships WHERE member_id=$1 ORDER BY starts_on DESC LIMIT 1',
          [users.m.id],
        )
      )[0];
      const _renew = await req(
        'Solicitud renovar membresía sembrada',
        'POST',
        `/memberships/${mem.id}/renewals`,
        'a',
        { planId: mem.plan_id },
        201,
      );
      await req(
        'Solicitud renovar ajeno rol',
        'POST',
        `/memberships/${mem.id}/renewals`,
        'm',
        { planId: mem.plan_id },
        403,
      );
      const payid = randomUUID();
      await q(
        "INSERT INTO payments(id,member_id,concept,amount_usd,status,due_date,method,paid_at,registered_by_id,created_at,updated_at) VALUES($1,$2,'SESION_ADICIONAL',18.25,'PAGADO',now(),'EFECTIVO',now(),$3,now(),now())",
        [payid, users.m.id, users.a.id],
      );
      const rec = (
        await q(
          "INSERT INTO receipts(payment_id,method,issued_at) VALUES($1,'EFECTIVO',now()) RETURNING id,number::text",
          [payid],
        )
      )[0];
      const pdf = await req(
        'PDF comprobante fixture pagado',
        'GET',
        `/receipts/${rec.id}/pdf`,
        'm',
        undefined,
        200,
        (d) => d.startsWith('%PDF'),
      );
      fs.writeFileSync(path.join(workDir, 'receipt.audit.pdf'), pdf.bytes);
      check(
        'PDF Content-Type correcto',
        pdf.headers.get('content-type').includes('application/pdf'),
      );
      await req(
        'PDF comprobante ajeno no visible',
        'GET',
        `/receipts/${rec.id}/pdf`,
        'm2',
        undefined,
        404,
      );
      await req(
        'PDF recepción permitido',
        'GET',
        `/receipts/${rec.id}/pdf`,
        'a',
        undefined,
        200,
      );
      await req(
        'Buscar comprobante real',
        'GET',
        `/payments?receiptNumber=C-${rec.number.padStart(6, '0')}`,
        'a',
        undefined,
        200,
        (d) => d.paymentId === payid,
      );
      await req(
        'Buscar comprobante inexistente',
        'GET',
        '/payments?receiptNumber=C-999999',
        'a',
        undefined,
        404,
      );
      await req(
        'Buscar comprobante formato inválido',
        'GET',
        '/payments?receiptNumber=123',
        'a',
        undefined,
        400,
      );
      await req(
        'Anular motivo corto validación',
        'PATCH',
        `/payments/${payid}/void`,
        'a',
        { reason: 'error' },
        400,
      );
      await req(
        'Anular cobro pagado fixture',
        'PATCH',
        `/payments/${payid}/void`,
        'a',
        { reason: 'Cobro registrado por error en recepción' },
        200,
      );
      const state = (
        await q('SELECT status FROM payments WHERE id=$1', [payid])
      )[0];
      check('Anulación persistió', state.status === 'ANULADO', { state });
      const replacement = (
        await q(
          "SELECT amount_usd::text AS amount FROM payments WHERE member_id=$1 AND concept='SESION_ADICIONAL' AND status='PENDIENTE' ORDER BY created_at DESC LIMIT 1",
          [users.m.id],
        )
      )[0];
      check(
        'H21 reemplazo SESION_ADICIONAL usa tarifa provisional USD 15',
        replacement?.amount === '15.00',
        { amount: replacement?.amount ?? null },
      );
      await req(
        'Historial incluye comprobante',
        'GET',
        '/payments/history/me',
        'm',
        undefined,
        200,
        (d) =>
          d.data.some((x) => x.paymentId === payid && x.receiptId === rec.id),
      );
      await req(
        'Pendientes con overdue NONE',
        'GET',
        '/payments/pending?overdue=NONE',
        'a',
        undefined,
        200,
      );
      await req(
        'Pendientes con concepto',
        'GET',
        '/payments/pending?concept=SESION_PERSONAL',
        'a',
        undefined,
        200,
      );
      await req(
        'Pendientes con concepto y atraso',
        'GET',
        '/payments/pending?concept=SESION_PERSONAL&overdue=NONE',
        'a',
        undefined,
        200,
      );
      const pending = (
        await q(
          "SELECT id FROM payments WHERE status='PENDIENTE' AND member_id=$1 LIMIT 1",
          [users.m.id],
        )
      )[0];
      await req(
        'Anular pago pendiente',
        'PATCH',
        `/payments/${pending.id}/void`,
        'a',
        { reason: 'Cobro registrado por error en recepción' },
        409,
      );
      await req(
        'Cobrar tarjeta sin datos completos',
        'POST',
        `/payments/${pending.id}/collect`,
        'a',
        { method: 'TARJETA', cardNumber: '1111222233331234' },
        400,
      );
      await req(
        'H19 cobro de pago inexistente devuelve 400',
        'POST',
        `/payments/${unknown}/collect`,
        'a',
        { method: 'EFECTIVO' },
        400,
      );
      await req(
        'Tarjeta miembro rechazo simulación',
        'POST',
        `/payments/${pending.id}/card`,
        'm',
        {
          cardNumber: '1111222233335678',
          holder: 'Miembro Uno',
          expiry: '12/30',
          cvv: '123',
        },
        400,
      );
    },
  );
  await section('Notificaciones HTTP con cola procesada', async () => {
    const r = await req(
      'Bandeja propia con eventos',
      'GET',
      '/notifications',
      'm',
      undefined,
      200,
    );
    const list = r.data.items || r.data.data || r.data.notifications || [];
    check('Hay notificaciones generadas por reservas', list.length > 0, {
      body: r.data,
    });
    if (list.length) {
      const id = list[0].id;
      await req(
        'Leer aviso ajeno',
        'PATCH',
        `/notifications/${id}/read`,
        'm2',
        undefined,
        404,
      );
      await req(
        'Leer aviso propio',
        'PATCH',
        `/notifications/${id}/read`,
        'm',
        undefined,
        200,
        (d) => d.success === true,
      );
      await req(
        'Leer aviso idempotente',
        'PATCH',
        `/notifications/${id}/read`,
        'm',
        undefined,
        200,
        (d) => d.alreadyRead === true,
      );
    }
    await req(
      'Filtro módulo no válido',
      'GET',
      '/notifications?module=ERROR',
      'm',
      undefined,
      400,
    );
    await req(
      'Filtro unread no booleano',
      'GET',
      '/notifications?unread=basura',
      'm',
      undefined,
      400,
    );
  });
  await section('Plazos, membresía y créditos', async () => {
    const tpl = (
      await q(
        'SELECT id,trainer_id,room_id FROM class_templates ORDER BY created_at LIMIT 1',
      )
    )[0];
    const next = (
      await q('SELECT * FROM memberships WHERE member_id=$1', [users.m2.id])
    )[0];
    const makeClass = async (hours, cap = 5) => {
      const id = randomUUID(),
        start = new Date(Date.now() + hours * 3600000),
        end = new Date(start.getTime() + 3600000);
      await q(
        "INSERT INTO class_sessions(id,class_template_id,trainer_id,room_id,starts_at,ends_at,capacity,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,'PROGRAMADA',now(),now())",
        [id, tpl.id, tpl.trainer_id, tpl.room_id, start, end, cap],
      );
      return id;
    };
    const near = await makeClass(2);
    const reserve = await req(
      'Reservar clase a dos horas',
      'POST',
      '/class-reservations',
      'm',
      { sessionId: near },
      201,
    );
    const rid = reserve.data.id || reserve.data.reservationId;
    await req(
      'Cancelar clase menos de doce horas',
      'PATCH',
      `/class-reservations/${rid}/cancel`,
      'm',
      undefined,
      409,
    );
    const noCredit = await makeClass(30);
    await q('UPDATE memberships SET credits_remaining=0 WHERE id=$1', [
      next.id,
    ]);
    await req(
      'Reservar sin créditos',
      'POST',
      '/class-reservations',
      'm2',
      { sessionId: noCredit },
      409,
    );
    await req(
      'Créditos agotados muestran vencida',
      'GET',
      '/memberships/me',
      'm2',
      undefined,
      200,
      (d) => d.membership.status === 'VENCIDA',
    );
    await q('UPDATE memberships SET credits_remaining=1 WHERE id=$1', [
      next.id,
    ]);
    const r = await req(
      'Último crédito se puede usar',
      'POST',
      '/class-reservations',
      'm2',
      { sessionId: noCredit },
      201,
    );
    check(
      'Último crédito queda cero',
      (
        await q('SELECT credits_remaining FROM memberships WHERE id=$1', [
          next.id,
        ])
      )[0].credits_remaining === 0,
    );
    await req(
      'Cancelar clase devuelve último crédito',
      'PATCH',
      `/class-reservations/${r.data.id || r.data.reservationId}/cancel`,
      'm2',
      undefined,
      200,
    );
    check(
      'Crédito devuelto',
      (
        await q('SELECT credits_remaining FROM memberships WHERE id=$1', [
          next.id,
        ])
      )[0].credits_remaining === 1,
    );
    await req(
      'Cancelar segunda vez no duplica crédito',
      'PATCH',
      `/class-reservations/${r.data.id || r.data.reservationId}/cancel`,
      'm2',
      undefined,
      409,
    );
    check(
      'Crédito no duplicado',
      (
        await q('SELECT credits_remaining FROM memberships WHERE id=$1', [
          next.id,
        ])
      )[0].credits_remaining === 1,
    );
    await q('UPDATE memberships SET credits_remaining=10 WHERE id=$1', [
      next.id,
    ]);
    const sl = randomUUID();
    const start = new Date(Date.now() + 6 * 3600000),
      end = new Date(start.getTime() + 3600000);
    await q(
      "INSERT INTO trainer_slots(id,trainer_id,starts_at,ends_at,status,created_at,updated_at) VALUES($1,$2,$3,$4,'LIBRE',now(),now())",
      [sl, users.t2.id, start, end],
    );
    const per = await req(
      'Reservar personal a seis horas',
      'POST',
      '/personal-sessions',
      'm',
      { slotId: sl },
      201,
    );
    await req(
      'Cancelar personal menos de doce horas',
      'PATCH',
      `/personal-sessions/${per.data.id}/cancel`,
      'm',
      undefined,
      409,
    );
    const mc = (
      await req('Máquinas para prueba', 'GET', '/machines', 'a', undefined, 200)
    ).data.data.find((x) => x.status === 'DISPONIBLE');
    const maintenance = await req(
      'Programar mantenimiento futuro',
      'POST',
      `/machines/${mc.id}/maintenance`,
      'a',
      { reason: 'Mantenimiento futuro de auditoría', startsAt: local(9, 10) },
      201,
    );
    await req(
      'Cerrar mantenimiento futuro ahora',
      'PATCH',
      `/machines/${mc.id}/maintenance/${maintenance.data.id}/complete`,
      'a',
      { endedAt: new Date().toISOString() },
      400,
    );
  });
  await section('Seguridad recursos y entradas extremas', async () => {
    for (const route of [
      '/membership-plans/' + unknown,
      '/class-templates/' + unknown,
      '/class-sessions/' + unknown,
    ])
      await req(
        'ID recurso inexistente ' + route,
        'PATCH',
        route,
        'a',
        {},
        404,
      );
    await req(
      'ID clase inválido',
      'PATCH',
      '/class-sessions/no-es-uuid',
      'a',
      { capacity: 3 },
      400,
    );
    await req(
      'ID plantilla inválido',
      'PATCH',
      '/class-templates/no-es-uuid',
      'a',
      { name: 'Clase inválida' },
      400,
    );
    await req(
      'Entrenador inexistente',
      'GET',
      `/trainers/${unknown}/slots`,
      'm',
      undefined,
      404,
    );
    await req(
      'Progreso ejercicio inexistente',
      'POST',
      '/progress-records',
      'm',
      {
        recordDate: date(-2),
        weightKg: 70,
        marks: [{ exerciseId: unknown, weightKg: 30, reps: 10 }],
      },
      400,
    );
    await req(
      'Reserva sin membresía vigente',
      'POST',
      '/class-reservations',
      'm3',
      {
        sessionId: (
          await q(
            "SELECT id FROM class_sessions WHERE status='PROGRAMADA' AND starts_at>now() ORDER BY starts_at DESC LIMIT 1",
          )
        )[0].id,
      },
      409,
    );
    await req(
      'Ingreso no permite fecha cliente',
      'POST',
      '/access/check-ins',
      'a',
      { memberId: users.m.id, checkedInAt: '2020-01-01T00:00Z' },
      400,
    );
    await req(
      'Evolución rango invertido',
      'GET',
      `/progress-records/me/evolution?from=${date()}&to=${date(-1)}`,
      'm',
      undefined,
      400,
    );
    await req(
      'Historial pagos fecha inexistente',
      'GET',
      '/payments/history/me?from=2026-02-30',
      'm',
      undefined,
      400,
    );
    await req(
      'Pagos miembro inexistente',
      'GET',
      `/members/${unknown}/payments?status=PENDIENTE`,
      'a',
      undefined,
      404,
    );
    await req(
      'Plan filtro no válido',
      'GET',
      '/membership-plans?status=ERROR',
      'a',
      undefined,
      400,
    );
    const plan = (
      await q("SELECT id FROM membership_plans WHERE name='Mensual auditoría'")
    )[0];
    await req(
      'Desactivar plan',
      'PATCH',
      `/membership-plans/${plan.id}`,
      'a',
      { status: 'INACTIVO' },
      200,
    );
    const number = (
      await q('SELECT member_number FROM member_profiles WHERE user_id=$1', [
        users.m3.id,
      ])
    )[0].member_number;
    await req(
      'Comprar plan inactivo',
      'POST',
      '/memberships/purchases',
      'a',
      { memberNumber: number, planId: plan.id },
      409,
    );
  });
  await section('Concurrencia personal y rutinas', async () => {
    const slot = await req(
      'Slot para carrera',
      'POST',
      '/trainer-slots',
      't2',
      { date: date(8), startTime: '18:00' },
      201,
    );
    const race = await Promise.all(
      ['m', 'm2'].map((role) =>
        req(
          'Carrera slot ' + role,
          'POST',
          '/personal-sessions',
          role,
          { slotId: slot.data.id },
          [201, 409],
        ),
      ),
    );
    check(
      'Carrera slot una reserva',
      (
        await q(
          "SELECT count(*)::int n FROM personal_sessions WHERE slot_id=$1 AND status='CONFIRMADA'",
          [slot.data.id],
        )
      )[0].n === 1,
      { statuses: race.map((x) => x.status) },
    );
    const routine = (
      await q(
        "SELECT version FROM training_routines WHERE member_id=$1 AND status='VIGENTE'",
        [users.m.id],
      )
    )[0];
    const ex = (await q('SELECT id FROM exercises LIMIT 1'))[0];
    const body = {
      name: 'Rutina concurrente',
      goal: 'Auditar control optimista',
      expectedCurrentVersion: routine.version,
      startsOn: date(),
      endsOn: date(20),
      exercises: [
        { exerciseId: ex.id, weekday: 1, sets: 3, reps: 10, position: 1 },
      ],
    };
    const out = await Promise.all(
      [1, 2].map((n) =>
        req(
          'Carrera versión rutina ' + n,
          'POST',
          `/training-routines/trainers/me/members/${users.m.id}/routines/versions`,
          't',
          body,
          [201, 409],
        ),
      ),
    );
    check(
      'Carrera rutina solo una vigente',
      (
        await q(
          "SELECT count(*)::int n FROM training_routines WHERE member_id=$1 AND status='VIGENTE'",
          [users.m.id],
        )
      )[0].n === 1,
      { statuses: out.map((x) => x.status) },
    );
  });
  await section('Coherencia reportes con base real', async () => {
    const expected = (
      await q(
        "SELECT COALESCE(sum(amount_usd),0)::text total FROM payments WHERE status='PAGADO' AND paid_at >=$1::date+interval '6 hours' AND paid_at<$2::date+interval '30 hours'",
        [date(), date()],
      )
    )[0];
    const report = await req(
      'Reporte ingresos día',
      'GET',
      `/reports/income?from=${date()}&to=${date()}`,
      'a',
      undefined,
      200,
    );
    check(
      'Ingresos coincide BD',
      Number(
        report.data.totalIncomeUsd || report.data.totalUsd || report.data.total,
      ) === Number(expected.total),
      { expected, body: report.data },
    );
    await req(
      'Reporte ocupación incluye sesiones finalizadas',
      'GET',
      `/reports/occupancy?from=${date()}&to=${date(10)}`,
      'a',
      undefined,
      200,
    );
    await req(
      'Reporte entrenadores con personales',
      'GET',
      `/reports/trainer-performance?from=${date(-5)}&to=${date(10)}`,
      'a',
      undefined,
      200,
    );
  });
} finally {
  await db.end();
  fs.writeFileSync(
    path.join(workDir, 'http-extra-results.json'),
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
