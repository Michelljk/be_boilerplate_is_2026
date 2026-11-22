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
  base = API_BASE;
function check(name, ok, detail = {}) {
  tests.push({ name, ok, ...detail });
  console.log(
    (ok ? 'PASS' : 'FAIL') + ' ' + name + ' ' + JSON.stringify(detail),
  );
}
async function q(s, a = []) {
  return (await db.query(s, a)).rows;
}
async function req(name, path, expected, assert) {
  const r = await fetch(base + path, {
      headers: { Authorization: 'Bearer ' + token },
    }),
    data = await r.json();
  check(name, r.status === expected, {
    method: 'GET',
    path,
    role: 'a',
    status: r.status,
    expected,
    body: data,
  });
  if (assert) check(name + ' [datos]', assert(data), { body: data });
  return data;
}
const login = await fetch(base + '/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@gkds.test',
    password: process.env.SEED_PASSWORD,
  }),
});
const token = (await login.json()).accessToken;
const plan = (
  await q(
    "SELECT id FROM membership_plans WHERE type='MONTHLY' AND status='ACTIVO' LIMIT 1",
  )
)[0];
const hash = (
  await q("SELECT password_hash FROM users WHERE email='miembro1@gkds.test'")
)[0].password_hash;
const ids = [];
async function member(label) {
  const id = randomUUID();
  ids.push(id);
  await q(
    "INSERT INTO users(id,email,password_hash,role,is_active,created_at,updated_at)VALUES($1,$2,$3,'MIEMBRO',true,now(),now())",
    [id, `retencion-${label}@audit.test`, hash],
  );
  return id;
}
async function membership(
  mid,
  starts,
  ends,
  concept = 'MEMBRESIA',
  owner = mid,
  status = 'PAGADO',
) {
  const pid = randomUUID(),
    id = randomUUID();
  await q(
    "INSERT INTO payments(id,member_id,concept,amount_usd,status,due_date,method,paid_at,created_at,updated_at)VALUES($1,$2,$3,30,$4,$5,'EFECTIVO',$5,now(),now())",
    [pid, owner, concept, status, starts],
  );
  await q(
    "INSERT INTO memberships(id,member_id,plan_id,payment_id,starts_on,ends_on,status,created_at,updated_at)VALUES($1,$2,$3,$4,$5,$6,'VIGENTE',now(),now())",
    [id, mid, plan.id, pid, starts, ends],
  );
  return id;
}
try {
  await req(
    'Retención sin cohortes previas',
    '/reports/retention?from=2026-09&to=2026-09',
    200,
    (d) =>
      d.months[0].expired === 0 &&
      d.months[0].renewalRate === null &&
      d.months[0].cancellationRate === null,
  );
  const a = await member('renovado'),
    b = await member('cancelado'),
    c = await member('reciente'),
    d = await member('concepto-incorrecto'),
    e = await member('titular-incorrecto'),
    f = await member('pago-pendiente');
  await membership(a, '2026-08-01', '2026-09-01');
  await membership(a, '2026-09-15', '2026-12-15');
  await membership(b, '2026-08-05', '2026-09-05');
  await membership(c, '2026-10-01', '2026-10-31');
  await membership(d, '2026-08-20', '2026-09-20');
  await membership(d, '2026-10-02', '2026-12-02', 'SESION_ADICIONAL');
  await membership(e, '2026-08-22', '2026-09-22');
  await membership(e, '2026-10-03', '2026-12-03', 'MEMBRESIA', b);
  await membership(f, '2026-08-25', '2026-09-25');
  await membership(f, '2026-10-05', '2026-12-05', 'MEMBRESIA', f, 'PENDIENTE');
  await req(
    'Retención cohortes correctas y pagos inválidos',
    '/reports/retention?from=2026-09&to=2026-09',
    200,
    (d) =>
      d.months[0].expired === 5 &&
      d.months[0].renewed === 1 &&
      d.months[0].cancelled === 4 &&
      d.months[0].renewalRate === '20.00' &&
      d.months[0].cancellationRate === '80.00',
  );
  await req(
    'Retención excluye vencidas sin treinta días',
    '/reports/retention?from=2026-10&to=2026-10',
    200,
    (d) => d.months[0].expired === 0 && d.months[0].renewalRate === null,
  );
  await req(
    'Retención rango invertido',
    '/reports/retention?from=2026-10&to=2026-09',
    400,
  );
  await req(
    'Retención doce meses exactos',
    '/reports/retention?from=2025-12&to=2026-11',
    200,
  );
  await req(
    'Retención trece meses',
    '/reports/retention?from=2025-11&to=2026-11',
    400,
  );
} finally {
  if (ids.length) {
    await q('DELETE FROM memberships WHERE member_id=ANY($1::uuid[])', [ids]);
    await q('DELETE FROM payments WHERE member_id=ANY($1::uuid[])', [ids]);
    await q('DELETE FROM users WHERE id=ANY($1::uuid[])', [ids]);
  }
  await db.end();
  fs.writeFileSync(
    path.join(workDir, 'http-retention-results.json'),
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
