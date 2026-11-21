import fs from 'node:fs';

const workDir = process.env.HTTP_RESULTS_DIR;
if (!workDir || process.env.HTTP_TEST_RUN !== 'true')
  throw new Error('Usa npm run test:http; esta prueba exige la base HTTP desechable.');
const origin = process.env.HTTP_API_ORIGIN + '/api';
const results = [];
function check(name, ok, detail = {}) {
  results.push({ name, ok, ...detail });
  console.log((ok ? 'PASS ' : 'FAIL ') + name);
  if (!ok) throw new Error(name + ': ' + JSON.stringify(detail));
}
const login = await fetch(origin + '/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'miembro1@gkds.test',
    password: process.env.HTTP_TEST_PASSWORD || process.env.SEED_PASSWORD,
  }),
});
const { accessToken } = await login.json();
check('H25 autenticación de miembro para evolución', login.status === 200, {
  status: login.status,
});
for (const [label, filter] of [
  ['from único', 'from=1900-01-01'],
  ['to único', 'to=1901-01-01'],
]) {
  const response = await fetch(
    origin + '/progress-records/me/evolution?metric=weightKg&' + filter,
    { headers: { Authorization: 'Bearer ' + accessToken } },
  );
  const data = await response.json();
  check('H25 acepta y acota ' + label, response.status === 200 &&
    Array.isArray(data.points) && data.points.length === 0, {
      status: response.status,
      pointCount: data.points?.length,
    });
}
fs.writeFileSync(
  workDir + '/h25-regression-results.json',
  JSON.stringify({ total: results.length, passed: results.length, failed: 0, results }, null, 2),
);
