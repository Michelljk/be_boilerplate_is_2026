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
import { createApplication } from '../../dist/bootstrap.js';
import { PrismaService } from '../../dist/prisma/services/prisma.service.js';
import { NotificationService } from '../../dist/notifications/services/notification.service.js';
const require = createRequire(new URL('../../package.json', import.meta.url)),
  { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const tests = [],
  tokens = {},
  users = {},
  base = API_BASE;
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
      (ok ? '' : JSON.stringify(detail).slice(0, 600)),
  );
}
async function req(name, method, path, role, body, status, assert) {
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
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  check(name, r.status === status, {
    method,
    path,
    role,
    status: r.status,
    expected: status,
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
    check('BLOCK ' + name, false, { error: e.message });
  }
}
const day = (n = 0) =>
  new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', {
    timeZone: 'America/El_Salvador',
  });
try {
  for (const [k, n] of [
    ['a', 'admin'],
    ['t', 'entrenador1'],
    ['m', 'miembro1'],
  ]) {
    const l = await req(
      'Login finales ' + k,
      'POST',
      '/auth/login',
      null,
      { email: n + '@gkds.test', password: process.env.SEED_PASSWORD },
      200,
    );
    tokens[k] = l.accessToken;
    users[k] = l.user;
  }
  await section('Fechas civiles de sesiones', async () => {
    const t = (await sql('SELECT * FROM class_templates LIMIT 1'))[0],
      sid = randomUUID();
    await sql(
      "INSERT INTO class_sessions(id,class_template_id,trainer_id,room_id,starts_at,ends_at,capacity,status,completed_at,completed_by_id,created_at,updated_at)VALUES($1,$2,$3,$4,'2026-04-21T01:00:00','2026-04-21T02:00:00',19,'COMPLETADA','2026-04-21T02:00:00',$3,now(),now())",
      [sid, t.id, t.trainer_id, t.room_id],
    );
    await req(
      'Ocupación usa día local anterior',
      'GET',
      '/reports/occupancy?from=2026-04-20&to=2026-04-20',
      'a',
      undefined,
      200,
      (d) => d.data.some((x) => x.classId === t.id && x.totalCapacity >= 19),
    );
    await req(
      'Ocupación excluye día UTC adyacente',
      'GET',
      '/reports/occupancy?from=2026-04-21&to=2026-04-21',
      'a',
      undefined,
      200,
      (d) => !d.data.some((x) => x.classId === t.id),
    );
    await req(
      'Desempeño usa día local anterior',
      'GET',
      '/reports/trainer-performance?from=2026-04-20&to=2026-04-20',
      'a',
      undefined,
      200,
      (d) =>
        d.data.find((x) => x.trainerId === t.trainer_id).completedSessions ===
        1,
    );
    await req(
      'Desempeño excluye día UTC adyacente',
      'GET',
      '/reports/trainer-performance?from=2026-04-21&to=2026-04-21',
      'a',
      undefined,
      200,
      (d) =>
        d.data.find((x) => x.trainerId === t.trainer_id).completedSessions ===
        0,
    );
    await sql('DELETE FROM class_sessions WHERE id=$1', [sid]);
  });
  await section('Progreso null no borra marcas', async () => {
    const old = (
      await sql(
        'SELECT pr.* FROM progress_records pr JOIN exercise_marks em ON em.progress_record_id=pr.id WHERE pr.member_id=$1 LIMIT 1',
        [users.m.id],
      )
    )[0];
    const marks = await sql(
      'SELECT * FROM exercise_marks WHERE progress_record_id=$1',
      [old.id],
    );
    await req(
      'PATCH marks null rechazado',
      'PATCH',
      `/progress-records/${old.id}`,
      'm',
      {
        recordDate: new Date(old.record_date).toISOString().slice(0, 10),
        weightKg: Number(old.weight_kg),
        marks: null,
      },
      400,
    );
    check(
      'PATCH null conserva marcas',
      (
        await sql('SELECT * FROM exercise_marks WHERE progress_record_id=$1', [
          old.id,
        ])
      ).length === marks.length,
    );
  });
  await section('Eliminar slot libre conserva historia', async () => {
    const slot = await req(
      'Slot dedicado para historial',
      'POST',
      '/trainer-slots',
      't',
      { date: day(14), startTime: '17:00' },
      201,
    );
    const session = await req(
      'Reservar para historial',
      'POST',
      '/personal-sessions',
      'm',
      { slotId: slot.id },
      201,
    );
    await req(
      'Cancelar para historial',
      'PATCH',
      `/personal-sessions/${session.id}/cancel`,
      'm',
      undefined,
      200,
    );
    await req(
      'Eliminar LIBRE tras cancelación',
      'DELETE',
      `/trainer-slots/${slot.id}`,
      't',
      undefined,
      204,
    );
    const history = (
      await sql('SELECT * FROM personal_sessions WHERE id=$1', [session.id])
    )[0];
    check(
      'Sesión histórica conservada al eliminar slot',
      history.status === 'CANCELADA' &&
        history.slot_id === null &&
        new Date(history.starts_at).toISOString() === session.startsAt,
    );
  });
  await section('Avisos transaccionales y SLA', async () => {
    const app = await createApplication();
    await app.init();
    const prisma = app.get(PrismaService),
      ns = app.get(NotificationService),
      refs = [];
    try {
      const start = Date.now();
      await prisma.$transaction(
        async (tx) => {
          for (let i = 0; i < 150; i++) {
            const ref = randomUUID();
            refs.push(ref);
            await ns.send(
              {
                memberIds: [users.m.id],
                module: 'RESERVAS',
                title: 'Aviso de prueba de plazo',
                message: 'Reserva confirmada dentro de su transacción',
                referenceId: ref,
                dedupeKey: 'latency-' + ref,
              },
              tx,
            );
          }
        },
        { timeout: 60000 },
      );
      const count = (
        await sql(
          'SELECT count(*)::int n FROM notifications WHERE reference_id=ANY($1::uuid[])',
          [refs],
        )
      )[0].n;
      check(
        '150 avisos visibles antes de un minuto',
        count === 150 && Date.now() - start < 60000,
        { count, elapsedMs: Date.now() - start },
      );
      await req(
        'Avisos visibles HTTP tras commit',
        'GET',
        '/notifications?module=RESERVAS&unread=true',
        'm',
        undefined,
        200,
        (d) => d.items.some((x) => refs.includes(x.referenceId)),
      );
      await req(
        'Filtro unread inválido rechazado',
        'GET',
        '/notifications?unread=basura',
        'm',
        undefined,
        400,
      );
      await sql(
        'DELETE FROM notifications WHERE reference_id=ANY($1::uuid[])',
        [refs],
      );
    } finally {
      await app.close();
    }
  });
  await section('Contrato literal buscador y filtros cobros', async () => {
    await req(
      'Buscador H19 literal',
      'GET',
      '/members?search=Miembro',
      'a',
      undefined,
      200,
      (d) =>
        Array.isArray(d.data) &&
        d.data.length <= 10 &&
        d.data.every(
          (x) =>
            typeof x.memberId === 'string' && typeof x.fullName === 'string',
        ),
    );
    await req(
      'Buscador H19 mínimo dos caracteres',
      'GET',
      '/members?search=a',
      'a',
      undefined,
      400,
    );
    await req(
      'Buscador H19 parámetro inválido',
      'GET',
      '/members?search=Miembro&unknown=1',
      'a',
      undefined,
      400,
    );
    await req(
      'Filtro pagos por miembro inválido',
      'GET',
      `/members/${users.m.id}/payments?status=BASURA`,
      'a',
      undefined,
      400,
    );
  });
} finally {
  await db.end();
  fs.writeFileSync(
    path.join(workDir, 'http-last-results.json'),
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
