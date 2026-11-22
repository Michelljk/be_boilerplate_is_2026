import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { routeInventory } from './route-inventory.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl)
  throw new Error(
    'Define TEST_DATABASE_URL de PostgreSQL 18; nunca uses tu base de producción.',
  );
const url = new URL(testUrl),
  database = decodeURIComponent(url.pathname.slice(1));
if (!database.endsWith('_test') || process.env.HTTP_RESET_DATABASE !== 'true')
  throw new Error(
    'La base debe terminar en _test y HTTP_RESET_DATABASE=true debe autorizar su reinicialización.',
  );
if (!process.version.startsWith('v24.'))
  throw new Error('Esta batería se valida con Node.js 24.x.');
const password = process.env.HTTP_TEST_PASSWORD || process.env.SEED_PASSWORD;
if (!password || password.length < 8)
  throw new Error(
    'Define HTTP_TEST_PASSWORD o SEED_PASSWORD de prueba (mínimo 8 caracteres).',
  );
const port = Number(process.env.HTTP_TEST_PORT || 3199);
if (!Number.isInteger(port) || port < 1024 || port > 65533)
  throw new Error('HTTP_TEST_PORT inválido.');
const work = path.join(root, 'test-results/http');
fs.mkdirSync(work, { recursive: true });
const env = {
  ...process.env,
  DATABASE_URL: testUrl,
  JWT_SECRET:
    process.env.JWT_SECRET ||
    'local-http-test-only-secret-at-least-thirty-two-characters',
  NODE_ENV: 'test',
  PORT: String(port),
  ALLOW_DEMO_SEED: 'true',
  SEED_PASSWORD: password,
  HTTP_TEST_PASSWORD: password,
  HTTP_RESULTS_DIR: work,
  HTTP_TEST_RUN: 'true',
  HTTP_TEST_PORT: String(port),
  HTTP_API_ORIGIN: 'http://127.0.0.1:' + port,
};
delete env.SEED_DATE;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function command(args, label) {
  console.log('PROBANDO: ' + label);
  const output = fs.openSync(
    path.join(work, label.replace(/[^a-z0-9-]/gi, '-') + '.log'),
    'w',
  );
  try {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env,
      stdio: ['ignore', output, output],
    });
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', resolve);
    });
    if (code !== 0)
      throw new Error(label + ' falló; consulta test-results/http.');
  } finally {
    fs.closeSync(output);
  }
}
const cli = path.join(root, 'node_modules/prisma/build/index.js');
await command(
  [cli, 'migrate', 'reset', '--force'],
  'migraciones-base-desechable',
);
await command([cli, 'db', 'seed'], 'seed');
await command(
  [path.join(root, 'node_modules/@nestjs/cli/bin/nest.js'), 'build'],
  'compilacion-nest',
);
await command(
  [
    path.join(root, 'node_modules/tsc-alias/dist/bin/index.js'),
    '-p',
    'tsconfig.build.json',
  ],
  'aliases-compilados',
);
const routes = routeInventory(root);
fs.writeFileSync(
  path.join(work, 'routes-static.json'),
  JSON.stringify(routes, null, 2),
);
const serverLog = fs.openSync(path.join(work, 'api.log'), 'w'),
  server = spawn(process.execPath, ['dist/main.js'], {
    cwd: root,
    env,
    stdio: ['ignore', serverLog, serverLog],
  });
const results = [];
let ready = false;
try {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null)
      throw new Error('La API terminó antes del healthcheck.');
    try {
      const r = await fetch(env.HTTP_API_ORIGIN + '/api/');
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await sleep(200);
  }
  if (!ready) throw new Error('La API no quedó lista en 20 segundos.');
  const openapi = await (
    await fetch(env.HTTP_API_ORIGIN + '/api/docs-json')
  ).json();
  fs.writeFileSync(
    path.join(work, 'openapi.json'),
    JSON.stringify(openapi, null, 2),
  );
  const stages = [
    ['http-audit', 'http-results'],
    ['http-extra', 'http-extra-results'],
    ['http-edge', 'http-edge-results'],
    ['http-deep', 'http-deep-results'],
    ['http-retention', 'http-retention-results'],
    ['http-last', 'http-last-results'],
    ['http-business', 'http-business-results'],
    ['internal-audit', 'internal-results'],
    ['h25-regression', 'h25-regression-results'],
  ];
  for (const [script, result] of stages) {
    const out = path.join(work, result + '.json');
    if (fs.existsSync(out)) fs.unlinkSync(out);
    await command([path.join(root, 'test/http', script + '.mjs')], script);
    const summary = JSON.parse(fs.readFileSync(out, 'utf8'));
    results.push(...summary.results);
    console.log(
      script +
        ': ' +
        summary.passed +
        '/' +
        summary.total +
        ' comprobaciones aprobadas',
    );
    if (summary.failed !== 0)
      throw new Error(script + ' conserva ' + summary.failed + ' fallos.');
  }
  // Comprobar que los alias /api/v1 mantienen las mismas guardias que /api.
  const login = await fetch(env.HTTP_API_ORIGIN + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@gkds.test', password }),
  });
  const admin = (await login.json()).accessToken;
  const unknown = randomUUID();
  for (const route of routes.filter((r) => !r.public)) {
    const resource = route.path.replace(/:\w+/g, unknown),
      r = await fetch(env.HTTP_API_ORIGIN + resource, {
        method: route.method,
        headers: { 'Content-Type': 'application/json' },
        body: route.method === 'GET' ? undefined : '{}',
      });
    results.push({
      name: 'Alias legado sin sesión ' + route.method + ' ' + route.path,
      method: route.method,
      path: resource,
      status: r.status,
      expected: 401,
      ok: r.status === 401,
    });
  }
  const alias = await fetch(
    env.HTTP_API_ORIGIN + '/api/v1/members?search=Miembro',
    { headers: { Authorization: 'Bearer ' + admin } },
  );
  results.push({
    name: 'Alias legado exitoso H19',
    method: 'GET',
    path: '/api/v1/members?search=Miembro',
    status: alias.status,
    expected: 200,
    ok: alias.status === 200,
  });
  const canonical = (p) =>
    p
      .split('?')[0]
      .replace(/^\/api\/v1/, '')
      .replace(/^\/api/, '')
      .replace(/\/$/, '');
  const roleNames = {
    a: 'RECEPCION_ADMIN',
    t: 'ENTRENADOR',
    t2: 'ENTRENADOR',
    m: 'MIEMBRO',
    m2: 'MIEMBRO',
    m3: 'MIEMBRO',
    new: 'MIEMBRO',
    v: 'MIEMBRO',
  };
  const coverage = routes.map((route) => {
    const pattern = new RegExp(
      '^' + canonical(route.path).replace(/:\w+/g, '[^/]+') + '$',
    );
    return {
      method: route.method,
      path: route.path,
      tested: results.some(
        (x) =>
          x.method === route.method &&
          typeof x.path === 'string' &&
          pattern.test(canonical(x.path)) &&
          x.status >= 200 &&
          x.status < 300 &&
          (route.public ||
            !route.roles ||
            route.roles.includes(roleNames[x.role] || 'NO_ROLE')),
      ),
    };
  });
  const failed = results.filter((x) => !x.ok),
    summary = {
      node: process.version,
      operations: routes.length,
      operationsPassed: coverage.filter((x) => x.tested).length,
      httpRequests: results.filter((x) => x.method).length,
      assertions: results.length,
      passed: results.filter((x) => x.ok).length,
      failed: failed.length,
      http500: results.filter((x) => x.status === 500).length,
      coverage,
      failures: failed,
    };
  fs.writeFileSync(
    path.join(work, 'summary.json'),
    JSON.stringify(summary, null, 2),
  );
  console.log(
    'RESULTADO FINAL: ' +
      JSON.stringify({ ...summary, coverage: undefined, failures: undefined }),
  );
  if (failed.length || coverage.some((x) => !x.tested))
    throw new Error(
      'Hay fallos o rutas sin caso exitoso; revisa summary.json.',
    );
} finally {
  server.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => server.once('exit', resolve)),
    sleep(3000),
  ]);
  if (server.exitCode === null) server.kill('SIGKILL');
  fs.closeSync(serverLog);
}
