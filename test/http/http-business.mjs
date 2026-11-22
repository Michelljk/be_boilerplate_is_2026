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
const require = createRequire(new URL('../../package.json', import.meta.url)),
  { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const results = [],
  base = API_BASE,
  tokens = {},
  users = {};
const day = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/El_Salvador' });
const sql = async (s, a = []) => (await db.query(s, a)).rows;
function check(name, ok, detail = {}) {
  results.push({ name, ok, ...detail });
  console.log(
    (ok ? 'PASS' : 'FAIL') +
      ' ' +
      name +
      ' ' +
      (ok ? '' : JSON.stringify(detail)),
  );
}
async function req(name, method, path, role, body, status) {
  const r = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(tokens[role] ? { Authorization: 'Bearer ' + tokens[role] } : {}),
    },
    ...(method === 'GET' || body === undefined
      ? {}
      : { body: JSON.stringify(body) }),
  });
  const data = await r.json();
  check(name, r.status === status, {
    method,
    path,
    role,
    status: r.status,
    expected: status,
    body: data,
  });
  return data;
}
try {
  for (const [k, n] of [
    ['a', 'admin'],
    ['m2', 'miembro2'],
    ['m3', 'miembro3'],
    ['new', 'auditoria'],
  ]) {
    const l = await req(
      'Login negocio ' + k,
      'POST',
      '/auth/login',
      null,
      { email: n + '@gkds.test', password: process.env.SEED_PASSWORD },
      200,
    );
    tokens[k] = l.accessToken;
    users[k] = l.user;
  }
  const expired = (
    await sql(
      'SELECT * FROM memberships WHERE member_id=$1 ORDER BY updated_at DESC LIMIT 1',
      [users.m3.id],
    )
  )[0];
  const pending = (
    await sql(
      "SELECT mr.payment_id FROM membership_requests mr WHERE member_id=$1 AND status='PENDIENTE_PAGO' ORDER BY created_at DESC LIMIT 1",
      [users.m3.id],
    )
  )[0];
  await req(
    'Pagar renovación de membresía vencida',
    'POST',
    `/payments/${pending.payment_id}/collect`,
    'a',
    { method: 'EFECTIVO' },
    200,
  );
  const renewed = (
    await sql('SELECT * FROM memberships WHERE id=$1', [expired.id])
  )[0];
  check(
    'Renovación vencida comienza el día del pago',
    new Date(renewed.starts_on).toISOString().slice(0, 10) === day(),
  );
  await req(
    'Renovación vencida habilita miembro',
    'GET',
    '/memberships/me',
    'm3',
    undefined,
    200,
  );
  const exhausted = (
    await sql(
      'SELECT * FROM memberships WHERE member_id=$1 ORDER BY updated_at DESC LIMIT 1',
      [users.m2.id],
    )
  )[0];
  await sql('UPDATE memberships SET credits_remaining=0 WHERE id=$1', [
    exhausted.id,
  ]);
  await req(
    'Solicitar renovación con créditos agotados',
    'POST',
    `/memberships/${exhausted.id}/renewals`,
    'a',
    { planId: exhausted.plan_id },
    201,
  );
  const ep = (
    await sql(
      "SELECT payment_id FROM membership_requests WHERE member_id=$1 AND status='PENDIENTE_PAGO' ORDER BY created_at DESC LIMIT 1",
      [users.m2.id],
    )
  )[0];
  await req(
    'Pagar renovación agotada',
    'POST',
    `/payments/${ep.payment_id}/collect`,
    'a',
    { method: 'EFECTIVO' },
    200,
  );
  const restored = (
    await sql(
      'SELECT m.*,mp.credits FROM memberships m JOIN membership_plans mp ON mp.id=m.plan_id WHERE m.id=$1',
      [exhausted.id],
    )
  )[0];
  check(
    'Renovación agotada reinicia fecha y créditos',
    new Date(restored.starts_on).toISOString().slice(0, 10) === day() &&
      restored.credits_remaining === restored.credits,
  );
  const replacement = (
    await sql(
      "SELECT mr.payment_id,mr.membership_id FROM membership_requests mr JOIN payments p ON p.id=mr.payment_id WHERE mr.member_id=$1 AND mr.status='PENDIENTE_PAGO' AND p.status='PENDIENTE' ORDER BY mr.created_at DESC LIMIT 1",
      [users.new.id],
    )
  )[0];
  const before = (
    await sql('SELECT * FROM memberships WHERE id=$1', [
      replacement.membership_id,
    ])
  )[0];
  const period = (
    await sql('SELECT * FROM membership_periods WHERE payment_id=$1', [
      before.payment_id,
    ])
  )[0];
  check(
    'La anulación de renovación restauró una vigencia pagada',
    (
      await sql('SELECT status FROM payments WHERE id=$1', [before.payment_id])
    )[0].status === 'PAGADO',
  );
  await req(
    'Recobrar renovación tras plan desactivado',
    'POST',
    `/payments/${replacement.payment_id}/collect`,
    'a',
    { method: 'EFECTIVO' },
    200,
  );
  const after = (
    await sql('SELECT * FROM memberships WHERE id=$1', [before.id])
  )[0];
  check(
    'Recobro renueva membresía y enlaza pago',
    after.payment_id === replacement.payment_id &&
      after.ends_on > before.ends_on,
  );
  const retained = (
    await sql('SELECT * FROM membership_periods WHERE payment_id=$1', [
      before.payment_id,
    ])
  )[0];
  check(
    'El periodo anterior no se sobrescribe',
    retained.ends_on.getTime() === period.ends_on.getTime() &&
      retained.starts_on.getTime() === period.starts_on.getTime(),
  );
  check(
    'Cada renovación pagada conserva su periodo',
    (
      await sql(
        'SELECT count(*)::int n FROM membership_periods WHERE membership_id=$1',
        [before.id],
      )
    )[0].n >= 3,
  );
  const creation = JSON.parse(
    fs.readFileSync(path.join(workDir, 'http-results.json'), 'utf8'),
  ).results.find(
    (x) =>
      x.method === 'POST' &&
      x.path === '/class-reservations' &&
      x.status === 201 &&
      x.body?.createdAt,
  );
  const timestamp = (
    await sql('SELECT created_at FROM class_reservations WHERE id=$1', [
      creation.body.id,
    ])
  )[0];
  check(
    'createdAt de reserva coincide con la base',
    creation.body.createdAt === timestamp.created_at.toISOString(),
  );
} finally {
  await db.end();
  fs.writeFileSync(
    path.join(workDir, 'http-business-results.json'),
    JSON.stringify(
      {
        total: results.length,
        passed: results.filter((x) => x.ok).length,
        failed: results.filter((x) => !x.ok).length,
        results,
      },
      null,
      2,
    ),
  );
  console.log(
    'SUMMARY',
    results.length,
    results.filter((x) => x.ok).length,
    results.filter((x) => !x.ok).length,
  );
}
