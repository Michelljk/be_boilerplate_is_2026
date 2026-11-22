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
const require = createRequire(new URL('../../package.json', import.meta.url)),
  { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const tests = [],
  tokens = {},
  users = {};
const date = (n = 0) =>
  new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', {
    timeZone: 'America/El_Salvador',
  });
async function sql(s, a = []) {
  return (await db.query(s, a)).rows;
}
function check(name, ok, detail = {}) {
  tests.push({ name, ok, ...detail });
  console.log(
    (ok ? 'PASS' : 'FAIL') +
      ' ' +
      name +
      ' ' +
      (ok ? '' : JSON.stringify(detail).slice(0, 450)),
  );
}
async function req(name, method, path, role, body, expect, assert) {
  const r = await fetch(API_BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(role ? { Authorization: 'Bearer ' + tokens[role] } : {}),
    },
    ...(method === 'GET' || body === undefined
      ? {}
      : { body: JSON.stringify(body) }),
  });
  let data = await r.json();
  check(name, (Array.isArray(expect) ? expect : [expect]).includes(r.status), {
    method,
    path,
    role,
    status: r.status,
    expected: expect,
    body: data,
  });
  if (assert) check(name + ' [datos]', assert(data), { body: data });
  return data;
}
async function section(name, fn) {
  console.log('\n### ' + name);
  try {
    await fn();
  } catch (e) {
    check('BLOCK ' + name, false, { error: e.message, stack: e.stack });
  }
}
try {
  for (const [k, name] of [
    ['a', 'admin'],
    ['t', 'entrenador1'],
    ['t2', 'entrenador2'],
    ['m', 'miembro1'],
    ['m2', 'miembro2'],
    ['m3', 'miembro3'],
  ]) {
    const d = await req(
      'Login límites ' + k,
      'POST',
      '/auth/login',
      null,
      { email: name + '@gkds.test', password: process.env.SEED_PASSWORD },
      200,
    );
    tokens[k] = d.accessToken;
    users[k] = d.user;
  }
  await section('Membresías futuras, vencidas y nombres', async () => {
    const membership = (
      await sql('SELECT * FROM memberships WHERE member_id=$1', [users.m3.id])
    )[0];
    await req(
      'Renovar membresía vencida',
      'POST',
      `/memberships/${membership.id}/renewals`,
      'a',
      { planId: membership.plan_id },
      201,
    );
    await sql(
      "UPDATE memberships SET starts_on=$2::date,ends_on=$3::date,status='VIGENTE' WHERE id=$1",
      [membership.id, date(2), date(32)],
    );
    await req(
      'Membresía futura no debe ser vigente',
      'GET',
      '/memberships/me',
      'm3',
      undefined,
      200,
      (d) => d.membership.status === 'VENCIDA',
    );
    await sql(
      'UPDATE memberships SET starts_on=$2,ends_on=$3,status=$4 WHERE id=$1',
      [
        membership.id,
        membership.starts_on,
        membership.ends_on,
        membership.status,
      ],
    );
    const _blank = await req(
      'Nombre plan solo espacios',
      'POST',
      '/membership-plans',
      'a',
      {
        name: '   ',
        type: 'MONTHLY',
        priceUsd: '20.00',
        durationMonths: 1,
        benefits: ['Beneficio de prueba'],
        status: 'ACTIVO',
      },
      400,
    );
    const plan = (await sql('SELECT id FROM membership_plans LIMIT 1'))[0];
    await req(
      'Editar status null debe rechazarse',
      'PATCH',
      `/membership-plans/${plan.id}`,
      'a',
      { status: null },
      400,
    );
    const free = await req(
      'Plan gratis permitido por DTO',
      'POST',
      '/membership-plans',
      'a',
      {
        name: 'Plan de cero dólares auditoría',
        type: 'MONTHLY',
        priceUsd: '0.00',
        durationMonths: 1,
        benefits: ['Beneficio de prueba'],
        status: 'ACTIVO',
      },
      201,
    );
    const num = (
      await sql('SELECT member_number FROM member_profiles WHERE user_id=$1', [
        users.m3.id,
      ])
    )[0].member_number;
    await req(
      'Compra plan precio cero rechazo controlado',
      'POST',
      '/memberships/purchases',
      'a',
      { memberNumber: num, planId: free.id },
      [400, 409],
    );
  });
  await section(
    'Rangos invertidos dentro del mes y límite 12 meses',
    async () => {
      for (const report of ['occupancy', 'income', 'trainer-performance']) {
        await req(
          'Rango invertido mismo mes ' + report,
          'GET',
          `/reports/${report}?from=2026-11-20&to=2026-11-01`,
          'a',
          undefined,
          400,
        );
        await req(
          'Rango exacto 12 meses ' + report,
          'GET',
          `/reports/${report}?from=2025-11-19&to=2026-11-19`,
          'a',
          undefined,
          200,
        );
      }
    },
  );
  await section('Límites de día local en ingresos', async () => {
    const pay1 = randomUUID(),
      pay2 = randomUUID();
    await sql(
      "INSERT INTO payments(id,member_id,concept,amount_usd,status,due_date,method,paid_at,created_at,updated_at) VALUES($1,$3,'SESION_ADICIONAL',111.00,'PAGADO','2026-01-02','EFECTIVO','2026-01-02 01:00:00',now(),now()),($2,$3,'SESION_ADICIONAL',222.00,'PAGADO','2026-01-02','EFECTIVO','2026-01-02 07:00:00',now(),now())",
      [pay1, pay2, users.m.id],
    );
    await req(
      'Pago UTC 01:00 corresponde día local anterior',
      'GET',
      '/reports/income?from=2026-01-01&to=2026-01-01',
      'a',
      undefined,
      200,
      (d) => d.totalUsd === '111.00',
    );
    await req(
      'Pago UTC 07:00 corresponde día local actual',
      'GET',
      '/reports/income?from=2026-01-02&to=2026-01-02',
      'a',
      undefined,
      200,
      (d) => d.totalUsd === '222.00',
    );
    await sql('DELETE FROM payments WHERE id IN($1,$2)', [pay1, pay2]);
  });
  await section('Entrenadores y ajuste rutina contrato', async () => {
    await req(
      'Catálogo entrenadores con envelope',
      'GET',
      '/trainers',
      'm',
      undefined,
      200,
      (d) => Array.isArray(d.data),
    );
    await req(
      'Consultar rutina cliente ruta requerida',
      'GET',
      `/trainers/me/members/${users.m.id}/routines/current`,
      't',
      undefined,
      200,
    );
    const exercise = (
      await sql('SELECT id FROM exercises WHERE is_active=true LIMIT 1')
    )[0];
    const body = {
      name: 'Versión sin control esperado',
      goal: 'Probar requisito de concurrencia',
      startsOn: date(),
      endsOn: date(20),
      exercises: [
        { exerciseId: exercise.id, weekday: 1, sets: 3, reps: 10, position: 1 },
      ],
    };
    await req(
      'Versionado requiere expectedCurrentVersion',
      'POST',
      `/training-routines/trainers/me/members/${users.m.id}/routines/versions`,
      't',
      body,
      400,
    );
  });
  await section('Reservas nombres tras cambiar sesión', async () => {
    const r = (
      await sql(
        "SELECT cr.id,cr.session_id,cs.class_template_id,cs.room_id,cs.trainer_id FROM class_reservations cr JOIN class_sessions cs ON cs.id=cr.session_id WHERE cr.member_id=$1 AND cr.status='CONFIRMADA' AND cs.starts_at>now() ORDER BY cs.starts_at DESC LIMIT 1",
        [users.m.id],
      )
    )[0];
    const room = (
      await sql('SELECT id,name FROM rooms WHERE id<>$1 LIMIT 1', [r.room_id])
    )[0];
    await sql('UPDATE class_sessions SET room_id=$2 WHERE id=$1', [
      r.session_id,
      room.id,
    ]);
    await req(
      'Mis reservas muestra sala sesión actual',
      'GET',
      '/class-reservations/me',
      'm',
      undefined,
      200,
      (d) => d.data.find((x) => x.id === r.id).roomName === room.name,
    );
    await sql('UPDATE class_sessions SET room_id=$2 WHERE id=$1', [
      r.session_id,
      r.room_id,
    ]);
  });
  await section('Progreso con más de un año de registros', async () => {
    await sql(
      'INSERT INTO progress_records(id,member_id,record_date,weight_kg,created_at,updated_at) SELECT gen_random_uuid(),$1::uuid,$2::date-(400-i),50+i/10.0,now(),now() FROM generate_series(0,399) i ON CONFLICT(member_id,record_date) DO NOTHING',
      [users.m3.id, date()],
    );
    await req(
      'Evolución mantiene baseline inicial',
      'GET',
      '/progress-records/me/evolution?metric=weightKg',
      'm3',
      undefined,
      200,
      (d) =>
        d.baseline === 50 && d.points[0].value === 50 && d.points.length <= 365,
    );
  });
  await section('Promedios de clases históricas inactivas', async () => {
    const rated = (
      await sql(
        'SELECT cs.class_template_id FROM reviews r JOIN class_sessions cs ON cs.id=r.session_id LIMIT 1',
      )
    )[0];
    await sql("UPDATE class_templates SET status='INACTIVA' WHERE id=$1", [
      rated.class_template_id,
    ]);
    await req(
      'Promedio conserva clase con reseñas al desactivarla',
      'GET',
      '/reviews/averages?groupBy=class',
      'a',
      undefined,
      200,
      (d) => d.data.some((x) => x.entityId === rated.class_template_id),
    );
    await sql("UPDATE class_templates SET status='ACTIVA' WHERE id=$1", [
      rated.class_template_id,
    ]);
  });
  await section('Contrato notificaciones y duplicado ingreso', async () => {
    await req(
      'Bandeja módulo sesiones personales',
      'GET',
      '/notifications?module=SESIONES_PERSONALES',
      'm',
      undefined,
      200,
    );
    await req(
      'Bandeja unread false incluye todos estados',
      'GET',
      '/notifications?unread=false',
      'm',
      undefined,
      200,
      (d) => d.items.some((x) => x.status === 'NO_LEIDA'),
    );
    await req(
      'Duplicado vencido prioriza mensaje duplicado',
      'POST',
      '/access/check-ins',
      'a',
      { memberId: users.m3.id },
      409,
      (d) => d.message === 'El miembro ya registró su ingreso hoy',
    );
    const other = { id: randomUUID() };
    await sql(
      "INSERT INTO payments(id,member_id,concept,amount_usd,status,due_date,created_at,updated_at) VALUES($1,$2,'SESION_ADICIONAL',10,'PENDIENTE',now(),now(),now())",
      [other.id, users.m2.id],
    );
    await req(
      'Tarjeta rechazada en pago ajeno sigue siendo 404',
      'POST',
      `/payments/${other.id}/card`,
      'm',
      {
        cardNumber: '1111222233335678',
        holder: 'Miembro Uno',
        expiry: '12/30',
        cvv: '123',
      },
      404,
    );
  });
  await section('Concurrencia en agenda personal repetida', async () => {
    for (const [n, day] of [
      [1, 10],
      [2, 11],
      [3, 12],
    ]) {
      const s = await req(
        'Crear slot carrera ' + n,
        'POST',
        '/trainer-slots',
        't2',
        { date: date(day), startTime: '17:00' },
        201,
      );
      const _out = await Promise.all(
        ['m', 'm2'].map((k) =>
          req(
            'Carrera personal ' + n + ' ' + k,
            'POST',
            '/personal-sessions',
            k,
            { slotId: s.id },
            [201, 409],
          ),
        ),
      );
      check(
        'Carrera mantiene una reserva ' + n,
        (
          await sql(
            "SELECT count(*)::int n FROM personal_sessions WHERE slot_id=$1 AND status='CONFIRMADA'",
            [s.id],
          )
        )[0].n === 1,
      );
    }
  });
} finally {
  await db.end();
  fs.writeFileSync(
    path.join(workDir, 'http-edge-results.json'),
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
