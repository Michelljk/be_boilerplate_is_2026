import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const require = createRequire(root + '/package.json');
const { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const base = API_BASE;
const results = [];
const tokens = {};
const users = {};
function check(name, ok, detail = {}) {
  results.push({ name, ok, ...detail });
  console.log(
    (ok ? 'PASS' : 'FAIL') +
      ' ' +
      name +
      (ok ? '' : ' ' + JSON.stringify(detail).slice(0, 400)),
  );
}
async function req(name, method, path, role, body, expected, assertion) {
  const headers = {};
  if (role) headers.Authorization = 'Bearer ' + (tokens[role] || role);
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch((path.startsWith('/api/') ? API_ORIGIN : base) + path, {
      method,
      headers,
      ...(method === 'GET' || body === undefined
        ? {}
        : { body: JSON.stringify(body) }),
    });
  } catch (e) {
    check(name, false, { error: e.message });
    throw e;
  }
  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }
  const exp = Array.isArray(expected) ? expected : [expected];
  const ok =
    expected === undefined ? res.status < 500 : exp.includes(res.status);
  check(name, ok, {
    method,
    path,
    role: role || 'anon',
    status: res.status,
    expected,
    body: data,
  });
  if (assertion) check(name + ' [datos]', assertion(data), { body: data });
  return { status: res.status, data, raw, headers: res.headers };
}
async function query(sql, args = []) {
  return (await db.query(sql, args)).rows;
}
const date = (n = 0) =>
  new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', {
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
  await section('Autenticación y registro', async () => {
    await req('Salud', 'GET', '/', null, undefined, 200);
    for (const [key, email] of [
      ['a', 'admin'],
      ['t', 'entrenador1'],
      ['t2', 'entrenador2'],
      ['m', 'miembro1'],
      ['m2', 'miembro2'],
      ['m3', 'miembro3'],
    ]) {
      const r = await req(
        'Login ' + key,
        'POST',
        '/auth/login',
        null,
        { email: email + '@gkds.test', password: process.env.SEED_PASSWORD },
        200,
      );
      tokens[key] = r.data.accessToken;
      users[key] = r.data.user;
    }
    await req(
      'Login inválido',
      'POST',
      '/auth/login',
      null,
      { email: 'admin@gkds.test', password: 'WrongPass2026' },
      401,
    );
    await req(
      'Identidad token',
      'GET',
      '/auth/me',
      'm',
      undefined,
      200,
      (d) => d.id === users.m.id && !('passwordHash' in d),
    );
    await req('JWT inválido', 'GET', '/auth/me', 'invalido', undefined, 401);
    const body = {
      fullName: 'Miembro Auditoría',
      email: 'auditoria@gkds.test',
      password: process.env.SEED_PASSWORD,
      phone: '70000000',
    };
    await req(
      'Registro intenta escalar rol',
      'POST',
      '/users',
      null,
      { ...body, role: 'RECEPCION_ADMIN' },
      400,
    );
    const u = await req(
      'Registro crea miembro',
      'POST',
      '/users',
      null,
      body,
      201,
      (d) => d.role === 'MIEMBRO',
    );
    users.new = u.data;
    await req('Registro duplicado', 'POST', '/users', null, body, 409);
    await req(
      'Registro nombre breve',
      'POST',
      '/users',
      null,
      { ...body, email: 'short@gkds.test', fullName: 'ab' },
      400,
    );
    await req(
      'Registro contraseña breve',
      'POST',
      '/users',
      null,
      { ...body, email: 'short@gkds.test', password: 'Abc1' },
      400,
    );
    const l = await req(
      'Login recién registrado',
      'POST',
      '/auth/login',
      null,
      { email: body.email, password: body.password },
      200,
    );
    tokens.new = l.data.accessToken;
    const r = await req(
      'Rotar refresh',
      'POST',
      '/auth/refresh',
      null,
      { refreshToken: l.data.refreshToken },
      200,
    );
    await req(
      'Refresh reutilizado',
      'POST',
      '/auth/refresh',
      null,
      { refreshToken: l.data.refreshToken },
      401,
    );
    await req(
      'Logout',
      'POST',
      '/auth/logout',
      null,
      { refreshToken: r.data.refreshToken },
      204,
    );
    await req(
      'Refresh tras logout',
      'POST',
      '/auth/refresh',
      null,
      { refreshToken: r.data.refreshToken },
      401,
    );
  });
  const m = (
    await query(
      'SELECT id,member_number FROM member_profiles WHERE user_id=$1',
      [users.m.id],
    )
  )[0];
  const _m2 = (
    await query(
      'SELECT id,member_number FROM member_profiles WHERE user_id=$1',
      [users.m2.id],
    )
  )[0];
  const newm = (
    await query('SELECT member_number FROM member_profiles WHERE user_id=$1', [
      users.new.id,
    ])
  )[0];
  let _plans,
    rooms,
    _trainers,
    exercises,
    machines,
    template,
    session,
    _reservation,
    slot,
    personal,
    _purchase,
    _paid,
    receipt,
    progress,
    _routine;
  await section('Lecturas y filtros', async () => {
    _plans = (
      await req(
        'Catálogo planes',
        'GET',
        '/membership-plans',
        'a',
        undefined,
        200,
      )
    ).data.data;
    rooms = (await req('Catálogo salas', 'GET', '/rooms', 'a', undefined, 200))
      .data;
    _trainers = (
      await req(
        'Catálogo entrenadores',
        'GET',
        '/trainers',
        'm',
        undefined,
        200,
      )
    ).data.data;
    exercises = (
      await req('Catálogo ejercicios', 'GET', '/exercises', 't', undefined, 200)
    ).data.data;
    machines = (
      await req('Máquinas listado', 'GET', '/machines', 'm', undefined, 200)
    ).data.data;
    await req(
      'Membresía propia vigente',
      'GET',
      '/memberships/me',
      'm',
      undefined,
      200,
      (d) => d.membership?.status === 'VIGENTE',
    );
    await req(
      'Membresía inexistente',
      'GET',
      '/memberships/me',
      'new',
      undefined,
      200,
      (d) => d.membership === null,
    );
    await req(
      'Clases semanales',
      'GET',
      `/class-sessions?from=${date()}&to=${date(6)}`,
      'm',
      undefined,
      200,
    );
    await req(
      'Clases rango incorrecto',
      'GET',
      `/class-sessions?from=${date()}&to=${date(7)}`,
      'm',
      undefined,
      400,
    );
    await req(
      'Clases fecha inexistente',
      'GET',
      '/class-sessions?from=2026-02-30&to=2026-03-08',
      'm',
      undefined,
      400,
    );
    await req(
      'Clases filtro sala inválida',
      'GET',
      `/class-sessions?from=${date()}&to=${date(6)}&roomId=no`,
      'm',
      undefined,
      400,
    );
    await req(
      'Historial reservas propias',
      'GET',
      '/class-reservations/me',
      'm',
      undefined,
      200,
    );
    await req(
      'Disponibilidad propia entrenador',
      'GET',
      '/trainer-slots/me',
      't',
      undefined,
      200,
    );
    await req(
      'Disponibilidad entrenador para miembro',
      'GET',
      `/trainers/${users.t.id}/slots`,
      'm',
      undefined,
      200,
    );
    await req(
      'Sesiones personales propias',
      'GET',
      '/personal-sessions/me',
      'm',
      undefined,
      200,
    );
    await req(
      'Agenda día',
      'GET',
      `/trainers/me/agenda?view=day&date=${date()}`,
      't',
      undefined,
      200,
    );
    await req(
      'Agenda semana',
      'GET',
      `/trainers/me/agenda?view=week&date=${date()}`,
      't',
      undefined,
      200,
    );
    await req(
      'Buscar miembro por número',
      'GET',
      `/access/members?q=${m.member_number}`,
      'a',
      undefined,
      200,
    );
    await req(
      'Buscar miembro nombre',
      'GET',
      '/access/members?q=Miembro',
      'a',
      undefined,
      200,
    );
    await req(
      'Historial ingresos',
      'GET',
      '/access/check-ins',
      'a',
      undefined,
      200,
    );
    await req(
      'Pendientes propios',
      'GET',
      '/payments/pending/me',
      'm',
      undefined,
      200,
    );
    await req(
      'Historial pagos',
      'GET',
      '/payments/history/me',
      'm',
      undefined,
      200,
    );
    await req(
      'Pendientes globales',
      'GET',
      '/payments/pending',
      'a',
      undefined,
      200,
    );
    await req(
      'Pendientes de miembro',
      'GET',
      `/members/${users.m.id}/payments?status=PENDIENTE`,
      'a',
      undefined,
      200,
    );
    await req(
      'Clientes asignados',
      'GET',
      '/trainers/me/members',
      't',
      undefined,
      200,
    );
    await req(
      'Progreso cliente propio',
      'GET',
      `/trainers/me/members/${users.m.id}/progress`,
      't',
      undefined,
      200,
    );
    await req(
      'Progreso cliente otro entrenador',
      'GET',
      `/trainers/me/members/${users.m.id}/progress`,
      't2',
      undefined,
      404,
    );
    await req(
      'Rutina e historial propios',
      'GET',
      '/training-routines/me',
      'm',
      undefined,
      200,
    );
    await req(
      'Historial progreso propio',
      'GET',
      '/progress-records/me',
      'm',
      undefined,
      200,
    );
    await req(
      'Evolución peso',
      'GET',
      '/progress-records/me/evolution',
      'm',
      undefined,
      200,
    );
    await req(
      'Sesiones evaluables',
      'GET',
      '/reviews/eligible-sessions',
      'm',
      undefined,
      200,
    );
    await req(
      'Promedio por clase',
      'GET',
      '/reviews/averages?groupBy=class',
      'a',
      undefined,
      200,
    );
    await req(
      'Promedio entrenador',
      'GET',
      '/reviews/averages?groupBy=trainer',
      'a',
      undefined,
      200,
    );
    await req(
      'Bandeja notificaciones',
      'GET',
      '/notifications',
      'm',
      undefined,
      200,
    );
    await req(
      'No leídas contador',
      'GET',
      '/notifications/unread-count',
      'm',
      undefined,
      200,
    );
    for (const route of ['occupancy', 'income', 'trainer-performance'])
      await req(
        'Reporte ' + route,
        'GET',
        `/reports/${route}?from=${date(-30)}&to=${date()}`,
        'a',
        undefined,
        200,
      );
    await req(
      'Reporte retención',
      'GET',
      `/reports/retention?from=${date(-30).slice(0, 7)}&to=${date().slice(0, 7)}`,
      'a',
      undefined,
      200,
    );
  });
  await section('Planes, compra, cobro y renovación', async () => {
    const body = {
      name: 'Mensual auditoría',
      type: 'MONTHLY',
      priceUsd: '35.50',
      durationMonths: 1,
      benefits: ['Clases grupales'],
      status: 'ACTIVO',
    };
    const plan = (
      await req('Crear plan', 'POST', '/membership-plans', 'a', body, 201)
    ).data;
    await req(
      'Plan nombre duplicado',
      'POST',
      '/membership-plans',
      'a',
      body,
      409,
    );
    await req(
      'Plan precio negativo',
      'POST',
      '/membership-plans',
      'a',
      { ...body, name: 'Inválido auditoría', priceUsd: '-1.00' },
      400,
    );
    await req(
      'Plan duración incorrecta',
      'POST',
      '/membership-plans',
      'a',
      { ...body, name: 'Inválido duración', durationMonths: 2 },
      400,
    );
    await req(
      'Editar plan',
      'PATCH',
      `/membership-plans/${plan.id}`,
      'a',
      { benefits: ['Clases grupales', 'Sala libre'] },
      200,
    );
    _purchase = (
      await req(
        'Compra genera pendiente',
        'POST',
        '/memberships/purchases',
        'a',
        { memberNumber: newm.member_number, planId: plan.id },
        201,
      )
    ).data;
    await req(
      'Compra repetida pendiente',
      'POST',
      '/memberships/purchases',
      'a',
      { memberNumber: newm.member_number, planId: plan.id },
      409,
    );
    await req(
      'Pendiente no activa membresía',
      'GET',
      '/memberships/me',
      'new',
      undefined,
      200,
      (d) => d.membership === null,
    );
    const p = (
      await query(
        "SELECT id FROM payments WHERE member_id=$1 AND status='PENDIENTE' ORDER BY created_at DESC LIMIT 1",
        [users.new.id],
      )
    )[0];
    _paid = (
      await req(
        'Cobrar efectivo',
        'POST',
        `/payments/${p.id}/collect`,
        'a',
        { method: 'EFECTIVO' },
        200,
      )
    ).data;
    await req(
      'Cobro repetido',
      'POST',
      `/payments/${p.id}/collect`,
      'a',
      { method: 'EFECTIVO' },
      409,
    );
    let mem = (
      await req(
        'Pago activa membresía',
        'GET',
        '/memberships/me',
        'new',
        undefined,
        200,
        (d) => d.membership?.status === 'VIGENTE',
      )
    ).data.membership;
    receipt = (
      await query('SELECT id,number::text FROM receipts WHERE payment_id=$1', [
        p.id,
      ])
    )[0];
    const pdf = await req(
      'Comprobante PDF propietario',
      'GET',
      `/receipts/${receipt.id}/pdf`,
      'new',
      undefined,
      200,
      (d) => typeof d === 'string' && d.startsWith('%PDF'),
    );
    fs.writeFileSync(
      path.join(workDir, 'receipt.audit.pdf'),
      pdf.raw,
      'binary',
    );
    await req(
      'Comprobante PDF otro miembro',
      'GET',
      `/receipts/${receipt.id}/pdf`,
      'm',
      undefined,
      404,
    );
    await req(
      'Comprobante PDF recepción',
      'GET',
      `/receipts/${receipt.id}/pdf`,
      'a',
      undefined,
      200,
    );
    await req(
      'Buscar comprobante',
      'GET',
      `/payments?receiptNumber=C-${receipt.number.padStart(6, '0')}`,
      'a',
      undefined,
      200,
    );
    await req(
      'Renovar genera pendiente',
      'POST',
      `/memberships/${mem.id}/renewals`,
      'a',
      { planId: plan.id },
      201,
    );
    const rp = (
      await query(
        "SELECT id FROM payments WHERE member_id=$1 AND status='PENDIENTE' ORDER BY created_at DESC LIMIT 1",
        [users.new.id],
      )
    )[0];
    await req(
      'Cobrar renovación',
      'POST',
      `/payments/${rp.id}/collect`,
      'a',
      { method: 'EFECTIVO' },
      200,
    );
    await req(
      'Desactivar plan',
      'PATCH',
      `/membership-plans/${plan.id}`,
      'a',
      { status: 'INACTIVO' },
      200,
    );
    await req(
      'Renovar plan inactivo',
      'POST',
      `/memberships/${mem.id}/renewals`,
      'a',
      { planId: plan.id },
      409,
    );
    await req(
      'Plan inactivo no invalida compra anterior',
      'GET',
      '/memberships/me',
      'new',
      undefined,
      200,
      (d) => d.membership?.status === 'VIGENTE',
    );
    await req(
      'Anular pago motivo corto',
      'PATCH',
      `/payments/${rp.id}/void`,
      'a',
      { reason: 'Error' },
      400,
    );
    await req(
      'Anular cobro pagado',
      'PATCH',
      `/payments/${rp.id}/void`,
      'a',
      { reason: 'Cobro registrado por error de auditoría' },
      200,
    );
    await req(
      'Anular nuevamente',
      'PATCH',
      `/payments/${rp.id}/void`,
      'a',
      { reason: 'Cobro registrado por error de auditoría' },
      409,
    );
  });
  await section('Clases grupales, cupos y cancelación', async () => {
    const body = {
      name: 'Clase auditoría',
      trainerId: users.t.id,
      roomId: rooms[1].id,
      weekday: new Date(date(3) + 'T12:00Z').getUTCDay() || 7,
      startTime: '18:00',
      durationMinutes: 60,
      capacity: 1,
    };
    template = (
      await req('Crear plantilla', 'POST', '/class-templates', 'a', body, 201)
    ).data;
    await req(
      'Plantillas listado',
      'GET',
      '/class-templates',
      'a',
      undefined,
      200,
    );
    await req(
      'Editar plantilla',
      'PATCH',
      `/class-templates/${template.id}`,
      'a',
      { name: 'Clase auditoría editada' },
      200,
    );
    const gen = (
      await req(
        'Generar sesiones',
        'POST',
        `/class-templates/${template.id}/sessions`,
        'a',
        { fromDate: date(3), toDate: date(3) },
        201,
      )
    ).data;
    session = gen.sessions[0];
    await req(
      'Generación no duplica',
      'POST',
      `/class-templates/${template.id}/sessions`,
      'a',
      { fromDate: date(3), toDate: date(3) },
      201,
      (d) => d.created === 0,
    );
    await req(
      'Editar sesión',
      'PATCH',
      `/class-sessions/${session.id}`,
      'a',
      { capacity: 2 },
      200,
    );
    await req(
      'Reservar sin membresía',
      'POST',
      '/class-reservations',
      'new',
      { sessionId: unknown },
      404,
    );
    const cr = (
      await req(
        'Reservar clase',
        'POST',
        '/class-reservations',
        'm',
        { sessionId: session.id },
        201,
      )
    ).data;
    _reservation = cr;
    await req(
      'Reserva repetida debe rechazar duplicado',
      'POST',
      '/class-reservations',
      'm',
      { sessionId: session.id },
      409,
    );
    await req(
      'Cancelar reserva ajena',
      'PATCH',
      `/class-reservations/${cr.id || cr.reservationId}/cancel`,
      'm3',
      undefined,
      404,
    );
    await req(
      'Reserva consume crédito',
      'POST',
      '/class-reservations',
      'm2',
      { sessionId: session.id },
      201,
    );
    await req(
      'Reserva sin cupo',
      'POST',
      '/class-reservations',
      'm3',
      { sessionId: session.id },
      409,
    );
    await req(
      'Capacidad menor a reservas',
      'PATCH',
      `/class-sessions/${session.id}`,
      'a',
      { capacity: 1 },
      409,
    );
    await req(
      'Consultar asistentes',
      'GET',
      `/class-sessions/${session.id}/attendees`,
      't',
      undefined,
      200,
    );
    await req(
      'Asistentes entrenador ajeno',
      'GET',
      `/class-sessions/${session.id}/attendees`,
      't2',
      undefined,
      404,
    );
    await req(
      'Asistencia antes de inicio',
      'PATCH',
      `/class-reservations/${cr.id || cr.reservationId}/attendance`,
      't',
      { attendance: 'ASISTIO' },
      409,
    );
    await req(
      'Completar antes de terminar',
      'PATCH',
      `/class-sessions/${session.id}/complete`,
      't',
      undefined,
      409,
    );
    await req(
      'Cancelación propia a tiempo',
      'PATCH',
      `/class-reservations/${cr.id || cr.reservationId}/cancel`,
      'm',
      undefined,
      200,
    );
    await req(
      'Reserva histórica cancelada no se reactiva',
      'POST',
      '/class-reservations',
      'm',
      { sessionId: session.id },
      409,
    );
    await req(
      'Gimnasio cancela clase',
      'PATCH',
      `/class-sessions/${session.id}/cancel`,
      'a',
      { reason: 'Cancelación por revisión de auditoría' },
      200,
    );
    await req(
      'Reserva clase cancelada',
      'POST',
      '/class-reservations',
      'm3',
      { sessionId: session.id },
      409,
    );
    const credit = (
      await query(
        'SELECT credits_remaining FROM memberships WHERE member_id=$1',
        [users.m2.id],
      )
    )[0];
    check(
      'Cancelación gimnasio devuelve crédito',
      credit.credits_remaining === 10,
      { credit },
    );
  });
  await section('Slots y sesiones personales', async () => {
    slot = (
      await req(
        'Crear slot',
        'POST',
        '/trainer-slots',
        't',
        { date: date(4), startTime: '18:00' },
        201,
      )
    ).data;
    await req(
      'Slot duplicado',
      'POST',
      '/trainer-slots',
      't',
      { date: date(4), startTime: '18:00' },
      409,
    );
    await req(
      'Editar slot ajeno',
      'PATCH',
      `/trainer-slots/${slot.id}`,
      't2',
      { date: date(4), startTime: '19:00' },
      404,
    );
    await req(
      'Editar slot propio',
      'PATCH',
      `/trainer-slots/${slot.id}`,
      't',
      { date: date(4), startTime: '19:00' },
      200,
    );
    personal = (
      await req(
        'Agendar personal',
        'POST',
        '/personal-sessions',
        'm',
        { slotId: slot.id },
        201,
      )
    ).data;
    await req(
      'Agendar repetida rechaza horario ocupado',
      'POST',
      '/personal-sessions',
      'm',
      { slotId: slot.id },
      409,
    );
    await req(
      'Agendar horario ocupado',
      'POST',
      '/personal-sessions',
      'm3',
      { slotId: slot.id },
      409,
    );
    await req(
      'Editar slot reservado',
      'PATCH',
      `/trainer-slots/${slot.id}`,
      't',
      { date: date(4), startTime: '20:00' },
      409,
    );
    await req(
      'Eliminar slot reservado',
      'DELETE',
      `/trainer-slots/${slot.id}`,
      't',
      undefined,
      409,
    );
    await req(
      'Cancelar personal ajena',
      'PATCH',
      `/personal-sessions/${personal.id}/cancel`,
      'm3',
      undefined,
      404,
    );
    await req(
      'Asistencia personal antes inicio',
      'PATCH',
      `/personal-sessions/${personal.id}/attendance`,
      't',
      { attendance: 'ASISTIO' },
      409,
    );
    await req(
      'Cancelar personal propia',
      'PATCH',
      `/personal-sessions/${personal.id}/cancel`,
      'm',
      undefined,
      200,
    );
    await req(
      'Otra persona reserva slot liberado',
      'POST',
      '/personal-sessions',
      'm3',
      { slotId: slot.id },
      201,
    );
    const free = (
      await req(
        'Crear slot libre eliminable',
        'POST',
        '/trainer-slots',
        't',
        { date: date(5), startTime: '18:00' },
        201,
      )
    ).data;
    await req(
      'Eliminar slot propio libre',
      'DELETE',
      `/trainer-slots/${free.id}`,
      't',
      undefined,
      204,
    );
    await req(
      'Slot hora fuera de rango',
      'POST',
      '/trainer-slots',
      't',
      { date: date(5), startTime: '21:00' },
      400,
    );
    await req(
      'Slot fecha pasada',
      'POST',
      '/trainer-slots',
      't',
      { date: date(-1), startTime: '18:00' },
      400,
    );
  });
  await section('Tarjetas simuladas y cobros', async () => {
    const id = randomUUID();
    await query(
      "INSERT INTO payments(id,member_id,concept,amount_usd,status,due_date,created_at,updated_at) VALUES($1,$2,'SESION_ADICIONAL',10,'PENDIENTE',now(),now(),now())",
      [id, users.m.id],
    );
    const card = {
      cardNumber: '1111222233331234',
      holder: 'Miembro Auditoría',
      expiry: '12/30',
      cvv: '123',
    };
    await req(
      'Tarjeta miembro campos de especificación',
      'POST',
      `/payments/${id}/card`,
      'm',
      card,
      200,
    );
    const missing = randomUUID();
    await query(
      "INSERT INTO payments(id,member_id,concept,amount_usd,status,due_date,created_at,updated_at) VALUES($1,$2,'SESION_ADICIONAL',10,'PENDIENTE',now(),now(),now())",
      [missing, users.m.id],
    );
    await req(
      'Tarjeta miembro requiere titular y CVV',
      'POST',
      `/payments/${missing}/card`,
      'm',
      { cardNumber: card.cardNumber, expiry: card.expiry },
      400,
    );
    const collectionId = randomUUID();
    await query(
      "INSERT INTO payments(id,member_id,concept,amount_usd,status,due_date,created_at,updated_at) VALUES($1,$2,'SESION_ADICIONAL',10,'PENDIENTE',now(),now(),now())",
      [collectionId, users.m.id],
    );
    await req(
      'Cobro tarjeta recepción',
      'POST',
      `/payments/${collectionId}/collect`,
      'a',
      { method: 'TARJETA', ...card },
      200,
    );
    const decline = randomUUID();
    await query(
      "INSERT INTO payments(id,member_id,concept,amount_usd,status,due_date,created_at,updated_at) VALUES($1,$2,'SESION_ADICIONAL',10,'PENDIENTE',now(),now(),now())",
      [decline, users.m.id],
    );
    await req(
      'Tarjeta rechazada recepción',
      'POST',
      `/payments/${decline}/collect`,
      'a',
      { method: 'TARJETA', ...card, cardNumber: '1111222233335678' },
      400,
    );
    await req(
      'Tarjeta rechazada permanece pendiente',
      'GET',
      '/payments/pending/me',
      'm',
      undefined,
      200,
      (d) => d.data.some((x) => x.id === decline),
    );
    await req(
      'Pago monto manipulable',
      'POST',
      `/payments/${decline}/collect`,
      'a',
      { method: 'EFECTIVO', amountUsd: '0.01' },
      400,
    );
    await req(
      'Pago ajeno con tarjeta',
      'POST',
      `/payments/${decline}/card`,
      'm2',
      card,
      404,
    );
  });
  await section('Acceso al gimnasio', async () => {
    await req(
      'Registrar ingreso',
      'POST',
      '/access/check-ins',
      'a',
      { memberId: users.m.id },
      201,
    );
    await req(
      'Ingreso duplicado diario',
      'POST',
      '/access/check-ins',
      'a',
      { memberId: users.m.id },
      409,
    );
    await req(
      'Ingreso miembro inexistente',
      'POST',
      '/access/check-ins',
      'a',
      { memberId: unknown },
      404,
    );
    await req(
      'Ingreso a entrenador no permitido',
      'POST',
      '/access/check-ins',
      'a',
      { memberId: users.t.id },
      404,
    );
    await query(
      "UPDATE memberships SET ends_on=$2,status='VENCIDA' WHERE member_id=$1",
      [users.m3.id, date(-1)],
    );
    await req(
      'Ingreso vencido requiere confirmar',
      'POST',
      '/access/check-ins',
      'a',
      { memberId: users.m3.id },
      409,
      (d) =>
        d.code === 'MEMBERSHIP_EXPIRED_CONFIRMATION_REQUIRED' ||
        JSON.stringify(d).includes('VENCIDA'),
    );
    await req(
      'Ingreso vencido confirmado',
      'POST',
      '/access/check-ins',
      'a',
      { memberId: users.m3.id, confirmExpired: true },
      201,
    );
    await req(
      'Filtrar historial ingreso miembro',
      'GET',
      `/access/check-ins?memberNumber=${m.member_number}&from=${date()}&to=${date()}`,
      'a',
      undefined,
      200,
      (d) => d.total === 1,
    );
    await req(
      'Historial ingreso rango invertido',
      'GET',
      `/access/check-ins?from=${date()}&to=${date(-1)}`,
      'a',
      undefined,
      400,
    );
  });
  await section('Rutinas y progreso', async () => {
    const body = {
      memberId: users.m.id,
      name: 'Rutina auditoría',
      goal: 'Desarrollar fuerza',
      startsOn: date(),
      endsOn: date(20),
      exercises: [
        {
          exerciseId: exercises[0].id,
          weekday: 1,
          sets: 3,
          reps: 10,
          position: 1,
        },
      ],
    };
    _routine = (
      await req('Asignar rutina', 'POST', '/training-routines', 't', body, 201)
    ).data;
    await req(
      'Asignar cliente ajeno',
      'POST',
      '/training-routines',
      't2',
      body,
      404,
    );
    const current = (
      await req(
        'Consultar rutina vigente',
        'GET',
        '/training-routines/me',
        'm',
        undefined,
        200,
      )
    ).data.current;
    await req(
      'Detalle rutina propia',
      'GET',
      `/training-routines/${current.id}`,
      'm',
      undefined,
      200,
    );
    await req(
      'Detalle rutina ajena',
      'GET',
      `/training-routines/${current.id}`,
      'm2',
      undefined,
      404,
    );
    const versionbody = {
      ...body,
      expectedCurrentVersion: current.version,
      name: 'Rutina auditoría versión',
    };
    delete versionbody.memberId;
    await req(
      'Nueva versión ruta especificada',
      'POST',
      `/trainers/me/members/${users.m.id}/routines/versions`,
      't',
      versionbody,
      201,
    );
    await req(
      'Nueva versión ruta legacy compatible',
      'POST',
      `/training-routines/trainers/me/members/${users.m.id}/routines/versions`,
      't',
      { ...versionbody, expectedCurrentVersion: current.version + 1 },
      201,
    );
    await req(
      'Versión obsoleta',
      'POST',
      `/training-routines/trainers/me/members/${users.m.id}/routines/versions`,
      't',
      versionbody,
      409,
    );
    const input = {
      recordDate: date(),
      weightKg: 75.5,
      waistCm: 85,
      marks: [{ exerciseId: exercises[0].id, weightKg: 40, reps: 10 }],
    };
    progress = (
      await req(
        'Registrar progreso',
        'POST',
        '/progress-records',
        'm',
        input,
        201,
      )
    ).data;
    await req(
      'Progreso fecha duplicada',
      'POST',
      '/progress-records',
      'm',
      input,
      409,
    );
    await req(
      'Progreso fecha futura',
      'POST',
      '/progress-records',
      'm',
      { ...input, recordDate: date(1) },
      400,
    );
    await req(
      'Progreso fecha inexistente',
      'POST',
      '/progress-records',
      'm',
      { ...input, recordDate: '2026-02-30' },
      400,
    );
    await req(
      'Progreso peso negativo',
      'POST',
      '/progress-records',
      'm',
      { ...input, weightKg: -1 },
      400,
    );
    await req(
      'Progreso marcas duplicadas',
      'POST',
      '/progress-records',
      'm',
      { ...input, marks: [input.marks[0], input.marks[0]] },
      400,
    );
    await req(
      'Editar progreso propio',
      'PATCH',
      `/progress-records/${progress.id}`,
      'm',
      { ...input, weightKg: 74 },
      200,
    );
    await req(
      'Editar progreso ajeno',
      'PATCH',
      `/progress-records/${progress.id}`,
      'm2',
      input,
      404,
    );
    await req(
      'Evolución con punto',
      'GET',
      `/progress-records/me/evolution?metric=weightKg&from=${date(-1)}&to=${date()}`,
      'm',
      undefined,
      200,
    );
    await req(
      'Evolución marcas ejercicio',
      'GET',
      `/progress-records/me/evolution?metric=exerciseWeightKg&exerciseId=${exercises[0].id}`,
      'm',
      undefined,
      200,
    );
    await req(
      'Evolución ejercicio falta',
      'GET',
      '/progress-records/me/evolution?metric=exerciseWeightKg',
      'm',
      undefined,
      400,
    );
    await req(
      'Privacidad progreso trainer',
      'GET',
      `/trainers/me/members/${users.m.id}/progress`,
      't',
      undefined,
      200,
    );
  });
  await section('Mantenimiento de máquinas', async () => {
    const machine = machines.find((x) => x.status === 'DISPONIBLE');
    const body = {
      reason: 'Mantenimiento preventivo de auditoría',
      startsAt: new Date(Date.now() - 3600000).toISOString(),
    };
    const maintenance = (
      await req(
        'Abrir mantenimiento',
        'POST',
        `/machines/${machine.id}/maintenance`,
        'a',
        body,
        201,
      )
    ).data;
    await req(
      'Mantenimiento abierto duplicado',
      'POST',
      `/machines/${machine.id}/maintenance`,
      'a',
      body,
      409,
    );
    await req(
      'Estado no disponible durante mantenimiento',
      'PATCH',
      `/machines/${machine.id}/status`,
      'a',
      { status: 'DISPONIBLE', reason: 'Finalizar sin cerrar auditoría' },
      409,
    );
    await req(
      'Cerrar mantenimiento fecha inconsistente',
      'PATCH',
      `/machines/${machine.id}/maintenance/${maintenance.id}/complete`,
      'a',
      { endedAt: new Date(Date.now() - 7200000).toISOString() },
      400,
    );
    await req(
      'Cerrar mantenimiento',
      'PATCH',
      `/machines/${machine.id}/maintenance/${maintenance.id}/complete`,
      'a',
      { endedAt: new Date().toISOString() },
      200,
    );
    await req(
      'Cerrar mantenimiento dos veces',
      'PATCH',
      `/machines/${machine.id}/maintenance/${maintenance.id}/complete`,
      'a',
      { endedAt: new Date().toISOString() },
      409,
    );
    await req(
      'Fuera servicio',
      'PATCH',
      `/machines/${machine.id}/status`,
      'a',
      { status: 'FUERA_SERVICIO', reason: 'Máquina averiada en auditoría' },
      200,
    );
    await req(
      'Restaurar disponible',
      'PATCH',
      `/machines/${machine.id}/status`,
      'a',
      { status: 'DISPONIBLE', reason: 'Máquina reparada en auditoría' },
      200,
    );
    await req(
      'Filtrar máquinas disponibles',
      'GET',
      '/machines?status=DISPONIBLE',
      'm',
      undefined,
      200,
      (d) => d.data.every((x) => x.status === 'DISPONIBLE'),
    );
  });
  await section('Notificaciones bandeja y propiedad', async () => {
    await req(
      'Filtrar notificaciones',
      'GET',
      '/notifications?module=RESERVAS&unread=true',
      'm',
      undefined,
      200,
    );
    const notifications = (
      await req(
        'Notificaciones emitidas por operaciones',
        'GET',
        '/notifications',
        'm',
        undefined,
        200,
      )
    ).data;
    const notice = notifications.items[0];
    if (notice) {
      await req(
        'Leer notificación ajena',
        'PATCH',
        `/notifications/${notice.id}/read`,
        'm2',
        undefined,
        404,
      );
      await req(
        'Leer notificación propia',
        'PATCH',
        `/notifications/${notice.id}/read`,
        'm',
        undefined,
        200,
      );
      await req(
        'Leer notificación idempotente',
        'PATCH',
        `/notifications/${notice.id}/read`,
        'm',
        undefined,
        200,
      );
    }
    await req(
      'Notificación módulo inválido',
      'GET',
      '/notifications?module=ERROR',
      'm',
      undefined,
      400,
    );
  });
  await section('Asistencia finalización y evaluación', async () => {
    const tpl = (
      await query('SELECT id FROM class_templates ORDER BY created_at LIMIT 1')
    )[0];
    const room = rooms[2].id;
    const sid = randomUUID();
    const start = new Date(Date.now() - 7200000),
      end = new Date(Date.now() - 3600000);
    await query(
      "INSERT INTO class_sessions(id,class_template_id,trainer_id,room_id,starts_at,ends_at,capacity,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,5,'PROGRAMADA',now(),now())",
      [sid, tpl.id, users.t.id, room, start, end],
    );
    const rid = randomUUID();
    await query(
      "INSERT INTO class_reservations(id,session_id,member_id,status,attendance,created_at,updated_at) VALUES($1,$2,$3,'CONFIRMADA','PENDIENTE',now(),now())",
      [rid, sid, users.m.id],
    );
    await req(
      'Registrar asistencia clase terminada',
      'PATCH',
      `/class-reservations/${rid}/attendance`,
      't',
      { attendance: 'ASISTIO' },
      200,
    );
    await req(
      'Completar clase terminada',
      'PATCH',
      `/class-sessions/${sid}/complete`,
      't',
      undefined,
      200,
    );
    await req(
      'Editar asistencia clase completada',
      'PATCH',
      `/class-reservations/${rid}/attendance`,
      't',
      { attendance: 'NO_ASISTIO' },
      409,
    );
    await req(
      'Sesión completada evaluable',
      'GET',
      '/reviews/eligible-sessions',
      'm',
      undefined,
      200,
      (d) => d.data.some((x) => x.sessionId === sid || x.id === sid),
    );
    await req(
      'Calificación rating fuera rango',
      'POST',
      '/reviews',
      'm',
      { sessionId: sid, rating: 6 },
      400,
    );
    await req(
      'Evaluación miembro ajeno',
      'POST',
      '/reviews',
      'm2',
      { sessionId: sid, rating: 5 },
      404,
    );
    await req(
      'Evaluar clase asistida',
      'POST',
      '/reviews',
      'm',
      { sessionId: sid, rating: 5, comment: 'Buena clase de auditoría' },
      201,
    );
    await req(
      'Evaluación duplicada',
      'POST',
      '/reviews',
      'm',
      { sessionId: sid, rating: 4 },
      409,
    );
    await req(
      'Promedio refleja evaluación',
      'GET',
      '/reviews/averages?groupBy=trainer',
      'a',
      undefined,
      200,
    );
    const psid = randomUUID(),
      slid = randomUUID();
    await query(
      "INSERT INTO trainer_slots(id,trainer_id,starts_at,ends_at,status,created_at,updated_at) VALUES($1,$2,$3,$4,'RESERVADO',now(),now())",
      [slid, users.t.id, start, end],
    );
    await query(
      "INSERT INTO personal_sessions(id,slot_id,trainer_id,member_id,starts_at,ends_at,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,'CONFIRMADA',now(),now())",
      [psid, slid, users.t.id, users.m.id, start, end],
    );
    await req(
      'Registrar asistencia personal pasada',
      'PATCH',
      `/personal-sessions/${psid}/attendance`,
      't',
      { attendance: 'ASISTIO' },
      200,
    );
    await req(
      'Asistencia personal no editable',
      'PATCH',
      `/personal-sessions/${psid}/attendance`,
      't',
      { attendance: 'NO_ASISTIO' },
      409,
    );
    await req(
      'Review personal excluida por modelo H29',
      'POST',
      '/reviews',
      'm',
      { sessionId: psid, rating: 5 },
      404,
    );
  });
  await section('Concurrencia y consistencia', async () => {
    const tpl = (
      await query('SELECT id FROM class_templates ORDER BY created_at LIMIT 1')
    )[0];
    const sid = randomUUID();
    await query(
      "INSERT INTO class_sessions(id,class_template_id,trainer_id,room_id,starts_at,ends_at,capacity,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,1,'PROGRAMADA',now(),now())",
      [sid, tpl.id, users.t.id, rooms[2].id, local(7, 18), local(7, 19)],
    );
    const race = await Promise.all(
      ['m', 'm2', 'new'].map((role) =>
        req(
          'Carrera último cupo ' + role,
          'POST',
          '/class-reservations',
          role,
          { sessionId: sid },
          [201, 409],
        ),
      ),
    );
    const count = (
      await query(
        "SELECT count(*)::int AS n FROM class_reservations WHERE session_id=$1 AND status='CONFIRMADA'",
        [sid],
      )
    )[0].n;
    check('Carrera no sobrevende cupo', count === 1, {
      count,
      statuses: race.map((x) => x.status),
    });
    const payid = randomUUID();
    await query(
      "INSERT INTO payments(id,member_id,concept,amount_usd,status,due_date,created_at,updated_at) VALUES($1,$2,'SESION_ADICIONAL',10,'PENDIENTE',now(),now(),now())",
      [payid, users.m.id],
    );
    const pays = await Promise.all(
      [1, 2, 3].map((n) =>
        req(
          'Cobro simultáneo ' + n,
          'POST',
          `/payments/${payid}/collect`,
          'a',
          { method: 'EFECTIVO' },
          [200, 409],
        ),
      ),
    );
    const recs = (
      await query('SELECT count(*)::int n FROM receipts WHERE payment_id=$1', [
        payid,
      ])
    )[0].n;
    check('Cobro simultáneo un comprobante', recs === 1, {
      count: recs,
      statuses: pays.map((x) => x.status),
    });
    const _checkins = await Promise.all(
      [1, 2, 3].map((n) =>
        req(
          'Ingreso simultáneo ' + n,
          'POST',
          '/access/check-ins',
          'a',
          { memberId: users.m2.id },
          [201, 409],
        ),
      ),
    );
    check(
      'Ingreso simultáneo una fila',
      (
        await query(
          'SELECT count(*)::int n FROM check_ins WHERE member_id=$1',
          [users.m2.id],
        )
      )[0].n === 1,
    );
  });
  await section('Matriz de seguridad en todas las rutas', async () => {
    const routes = JSON.parse(
      fs.readFileSync(path.join(workDir, 'routes-static.json'), 'utf8'),
    );
    for (const r of routes) {
      const path = r.path.replace(/:(\w+)/g, unknown);
      const publicRoute =
        r.public ||
        [
          '/api/v1/users',
          '/api/v1/auth/login',
          '/api/v1/auth/refresh',
          '/api/v1/auth/logout',
          '/api/v1/',
        ].includes(r.path);
      if (!publicRoute)
        await req(
          'Sin sesión ' + r.method + ' ' + r.path,
          r.method,
          path,
          null,
          r.method === 'GET' ? undefined : {},
          401,
        );
      let roletext = r.roles
        .replace(/\bADMIN\b/g, 'RECEPCION_ADMIN')
        .replace(/\bMEMBER\b/g, 'MIEMBRO');
      const allow = ['MIEMBRO', 'ENTRENADOR', 'RECEPCION_ADMIN'].filter((x) =>
        roletext.includes(x),
      );
      if (allow.length) {
        for (const [role, full] of [
          ['m', 'MIEMBRO'],
          ['t', 'ENTRENADOR'],
          ['a', 'RECEPCION_ADMIN'],
        ]) {
          if (!allow.includes(full))
            await req(
              'Rol prohibido ' + role + ' ' + r.method + ' ' + r.path,
              r.method,
              path,
              role,
              r.method === 'GET' ? undefined : {},
              403,
            );
        }
      }
    }
  });
  await section('Validación genérica de rutas y límites', async () => {
    const gets = [
      ['/class-reservations/me', 'm'],
      ['/personal-sessions/me', 'm'],
      ['/machines', 'm'],
      ['/access/check-ins', 'a'],
      ['/payments/history/me', 'm'],
      ['/payments/pending', 'a'],
      ['/progress-records/me', 'm'],
      ['/notifications', 'm'],
      ['/reviews/eligible-sessions', 'm'],
      ['/trainers/me/members', 't'],
    ];
    for (const [path, role] of gets) {
      await req(
        'Página cero ' + path,
        'GET',
        path + '?page=0',
        role,
        undefined,
        400,
      );
      await req(
        'Página grande ' + path,
        'GET',
        path + '?pageSize=999',
        role,
        undefined,
        400,
      );
      await req(
        'Campo desconocido ' + path,
        'GET',
        path + '?memberId=' + users.m2.id,
        role,
        undefined,
        400,
      );
    }
    for (const r of ['occupancy', 'income', 'trainer-performance'])
      await req(
        'Reporte rango inválido ' + r,
        'GET',
        `/reports/${r}?from=2026-02-30&to=2026-03-01`,
        'a',
        undefined,
        400,
      );
    await req(
      'Reporte retención >12 meses',
      'GET',
      '/reports/retention?from=2025-01&to=2026-02',
      'a',
      undefined,
      400,
    );
  });
} finally {
  await db.end();
  const summary = {
    total: results.length,
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
  fs.writeFileSync(
    path.join(workDir, 'http-results.json'),
    JSON.stringify(summary, null, 2),
  );
  console.log(
    '\nSUMMARY ' + JSON.stringify({ ...summary, results: undefined }),
  );
}
