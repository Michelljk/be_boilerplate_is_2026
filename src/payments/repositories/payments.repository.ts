import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/services/prisma.service.js';
import { GymClock } from '../../common/time/gym-clock.service.js';
import { prepareReceipt } from '../../gkds/comprobantes/receipt-format.js';
import { serializable } from '../../common/repositories/serializable.js';
import { validateCollection } from '../../gkds/recepcion/collect-payment.js';
import { validatePaymentVoid } from '../../gkds/anulaciones/payment-void-validation.js';
import {
  isH16TestCardApproved,
  simulationReference,
} from '../payment-card-simulation.js';
import { MembershipsService } from '../../memberships/services/index.js';
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONCEPTS = ['MEMBRESIA', 'SESION_ADICIONAL', 'SESION_PERSONAL'];
type AnyRow = Record<string, any>;
@Injectable()
export class PaymentsRepository {
  constructor(
    private readonly db: PrismaService,
    private readonly clock: GymClock,
    private readonly memberships: MembershipsService,
  ) {}
  private id(value: string) {
    if (!UUID.test(value)) throw new BadRequestException('UUID inválido.');
  }
  private async query<T extends AnyRow>(
    sql: string,
    ...args: unknown[]
  ): Promise<T[]> {
    return this.db.$queryRawUnsafe<T[]>(sql, ...args);
  }
  async myPending(memberId: string) {
    return {
      data: await this.query(
        'SELECT id,concept,amount_usd AS "amountUsd",to_char(due_date,\'YYYY-MM-DD\') AS "dueDate" FROM payments WHERE member_id=$1::uuid AND status=\'PENDIENTE\' ORDER BY due_date,id',
        memberId,
      ),
    };
  }
  async payCard(id: string, memberId: string, body: any) {
    this.id(id);
    const { cardNumber, holder, expiry, cvv } = body ?? {};
    if (
      !/^\d{16}$/.test(cardNumber ?? '') ||
      !/^.{2,60}$/.test(holder ?? '') ||
      !/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry ?? '') ||
      !/^\d{3}$/.test(cvv ?? '')
    )
      throw new BadRequestException('Datos de tarjeta inválidos.');
    if (!isH16TestCardApproved(cardNumber))
      throw new BadRequestException({
        code: 'PAYMENT_DECLINED',
        message: 'Pago rechazado por la pasarela simulada.',
      });
    // Los campos PAN/CVV se usan solo en memoria y jamás se persisten ni registran.
    const last4 = cardNumber.slice(-4),
      ref = simulationReference();
    const paidAt = this.clock.now();
    return serializable(this.db, async (tx) => {
      const rows = await tx.$queryRawUnsafe<AnyRow[]>(
        'SELECT * FROM payments WHERE id=$1::uuid FOR UPDATE',
        id,
      );
      const p = rows[0];
      if (!p || p.member_id !== memberId)
        throw new NotFoundException('Pago no encontrado.');
      if (p.status !== 'PENDIENTE')
        throw new ConflictException('El pago ya fue procesado.');
      const updated = await tx.$queryRawUnsafe<AnyRow[]>(
        "UPDATE payments SET status='PAGADO',method='TARJETA',paid_at=$2,card_last4=$3,gateway_ref=$4,updated_at=$2 WHERE id=$1::uuid AND status='PENDIENTE' RETURNING *",
        id,
        paidAt,
        last4,
        ref,
      );
      if (!updated.length) throw new ConflictException('Cobro simultáneo.');
      // H2: la membresa sólo nace cuando el cobro queda PAGADO, en esta misma
      // transacción; el cliente nunca envía fechas ni estado de vigencia.
      if (p.concept === 'MEMBRESIA') {
        await this.memberships.applyPaidRequestTx(tx, id, paidAt);
      }
      const rec = await this.makeReceipt(tx, updated[0]);
      await this.event(
        tx,
        id,
        memberId,
        'Pago registrado',
        p.concept,
        p.amount_usd,
      );
      return {
        paymentId: id,
        status: 'PAGADO',
        amountUsd: String(p.amount_usd),
        paidAt: paidAt.toISOString(),
        receiptNumber: rec.receiptNumber,
        cardLast4: last4,
        gatewayRef: ref,
      };
    });
  }
  async collect(id: string, actorId: string, body: any) {
    this.id(id);
    if (
      !['EFECTIVO', 'TARJETA'].includes(body?.method) ||
      Object.keys(body ?? {}).some((k) => k === 'amountUsd')
    )
      throw new BadRequestException('Solicitud de cobro inválida.');
    if (body.method === 'TARJETA' && !/^\d{16}$/.test(body.cardNumber ?? ''))
      throw new BadRequestException('Datos de tarjeta inválidos.');
    if (body.method === 'TARJETA' && !isH16TestCardApproved(body.cardNumber))
      throw new BadRequestException({
        code: 'PAYMENT_DECLINED',
        message: 'Pago rechazado por la pasarela simulada.',
      });
    return serializable(this.db, async (tx) => {
      const r = await tx.$queryRawUnsafe<AnyRow[]>(
        'SELECT * FROM payments WHERE id=$1::uuid FOR UPDATE',
        id,
      );
      const p = r[0];
      if (!p) throw new NotFoundException('Pago no encontrado.');
      if (p.status !== 'PENDIENTE')
        throw new ConflictException('El pago ya fue procesado.');
      validateCollection({
        paymentId: id,
        status: p.status,
        amountUsd: Number(p.amount_usd),
        method: body.method,
        cardLast4:
          body.method === 'TARJETA' ? body.cardNumber.slice(-4) : undefined,
      });
      const now = this.clock.now(),
        last = body.method === 'TARJETA' ? body.cardNumber.slice(-4) : null,
        ref = body.method === 'TARJETA' ? simulationReference() : null;
      const u = await tx.$queryRawUnsafe<AnyRow[]>(
        "UPDATE payments SET status='PAGADO',method=$2,paid_at=$3,registered_by_id=$4::uuid,card_last4=$5,gateway_ref=$6,updated_at=$3 WHERE id=$1::uuid AND status='PENDIENTE' RETURNING *",
        id,
        body.method,
        now,
        actorId,
        last,
        ref,
      );
      if (!u.length) throw new ConflictException('Cobro simultáneo.');
      if (p.concept === 'MEMBRESIA') {
        await this.memberships.applyPaidRequestTx(tx, id, now);
      }
      const receipt = await this.makeReceipt(tx, u[0]);
      await this.event(
        tx,
        id,
        p.member_id,
        'Pago registrado',
        p.concept,
        p.amount_usd,
      );
      return {
        paymentId: id,
        status: 'PAGADO',
        method: body.method,
        paidAt: now.toISOString(),
        receiptNumber: receipt.receiptNumber,
      };
    });
  }
  private async makeReceipt(tx: any, p: AnyRow) {
    const rows: AnyRow[] = await tx.$queryRawUnsafe(
      'SELECT COALESCE(up.full_name,u.email) AS name FROM users u LEFT JOIN user_profiles up ON up.user_id=u.id WHERE u.id=$1::uuid',
      p.member_id,
    );
    const r: AnyRow[] = await tx.$queryRawUnsafe(
      "INSERT INTO receipts(payment_id,number,method,issued_at) VALUES($1::uuid,nextval('receipt_number_seq'),$2,$3) RETURNING id,number",
      p.id,
      p.method,
      p.paid_at,
    );
    const view = prepareReceipt({
      number: Number(r[0].number),
      memberName: rows[0].name,
      concept: p.concept,
      amountUsd: Number(p.amount_usd),
      status: 'PAGADO',
      issuedAt: p.paid_at,
    });
    return { ...r[0], ...view };
  }
  async history(memberId: string, q: any) {
    const { from, to } = q;
    if (
      (from && !/^\d{4}-\d\d-\d\d$/.test(from)) ||
      (to && !/^\d{4}-\d\d-\d\d$/.test(to))
    )
      throw new BadRequestException('Fecha inválida.');
    if (from && to && to < from)
      throw new BadRequestException(
        'La fecha final no puede ser anterior a la inicial',
      );
    if (from && to) {
      const a = new Date(`${from}T00:00Z`),
        b = new Date(`${to}T00:00Z`);
      const max = new Date(a);
      max.setUTCMonth(max.getUTCMonth() + 12);
      if (b > max)
        throw new BadRequestException('El rango no puede superar 12 meses');
    }
    const page = Number(q.page ?? 1),
      size = Number(q.pageSize ?? 10);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(size) ||
      size < 1 ||
      size > 50
    )
      throw new BadRequestException('Paginación inválida.');
    const cond = ['p.member_id=$1::uuid', "p.status IN ('PAGADO','ANULADO')"],
      args: unknown[] = [memberId];
    if (from) {
      args.push(from);
      cond.push(`p.paid_at >= $${args.length}::date`);
    }
    if (to) {
      args.push(to);
      cond.push(`p.paid_at < ($${args.length}::date + interval '1 day')`);
    }
    const where = cond.join(' AND ');
    const count = await this.query(
      `SELECT count(*)::int n FROM payments p WHERE ${where}`,
      ...args,
    );
    args.push(size, (page - 1) * size);
    const data = await this.query(
      `SELECT p.id AS "paymentId",r.id AS "receiptId",p.paid_at AS "paidAt",p.concept,p.amount_usd::text AS "amountUsd",p.status,p.void_reason AS reason FROM payments p LEFT JOIN receipts r ON r.payment_id=p.id WHERE ${where} ORDER BY COALESCE(p.paid_at, p.created_at) DESC,p.id LIMIT $${args.length - 1} OFFSET $${args.length}`,
      ...args,
    );
    return { data, total: count[0].n, page, pageSize: size };
  }
  async pending(q: any) {
    if (q.concept && !CONCEPTS.includes(q.concept))
      throw new BadRequestException('Concepto no reconocido.');
    const ranges = ['NONE', 'D1_30', 'D31_60', 'OVER_60'];
    if (q.overdue && !ranges.includes(q.overdue))
      throw new BadRequestException('Rango de atraso incorrecto.');
    const page = Number(q.page ?? 1),
      size = Number(q.pageSize ?? 20);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(size) ||
      size < 1 ||
      size > 50
    )
      throw new BadRequestException('Paginación inválida.');
    const day = this.clock.today(),
      cond = ["p.status='PENDIENTE'"],
      a: unknown[] = [day];
    if (q.concept) {
      a.push(q.concept);
      cond.push(`p.concept=$${a.length}`);
    }
    const due = 'GREATEST(0,($1::date - p.due_date::date))';
    if (q.overdue) {
      const expr =
        q.overdue === 'NONE'
          ? `${due}=0`
          : q.overdue === 'D1_30'
            ? `${due} BETWEEN 1 AND 30`
            : q.overdue === 'D31_60'
              ? `${due} BETWEEN 31 AND 60`
              : `${due}>60`;
      cond.push(expr);
    }
    const where = cond.join(' AND '),
      count = await this.query(
        `SELECT count(*)::int n FROM payments p WHERE ${where}`,
        ...a,
      );
    a.push(size, (page - 1) * size);
    const data = await this.query(
      `SELECT p.id AS "paymentId",mp.member_number AS "memberNumber",COALESCE(up.full_name,u.email) AS "memberName",p.concept,p.amount_usd::text AS "amountUsd",to_char(p.due_date,'YYYY-MM-DD') AS "dueDate",${due}::int AS "daysOverdue" FROM payments p JOIN users u ON u.id=p.member_id LEFT JOIN member_profiles mp ON mp.user_id=u.id LEFT JOIN user_profiles up ON up.user_id=u.id WHERE ${where} ORDER BY "daysOverdue" DESC,p.due_date,p.id LIMIT $${a.length - 1} OFFSET $${a.length}`,
      ...a,
    );
    return { data, total: count[0].n, page, pageSize: size };
  }
  async voidSearch(receiptNumber: string) {
    if (!/^C-\d{6}$/.test(receiptNumber ?? ''))
      throw new BadRequestException('Formato de comprobante inválido.');
    const x = await this.query(
      'SELECT p.id AS "paymentId",COALESCE(up.full_name,u.email) AS "memberName",p.concept,p.amount_usd::text AS "amountUsd",p.status,p.paid_at AS "paidAt" FROM receipts r JOIN payments p ON p.id=r.payment_id JOIN users u ON u.id=p.member_id LEFT JOIN user_profiles up ON up.user_id=u.id WHERE r.number=substring($1 from 3)::int',
      receiptNumber,
    );
    if (!x.length) throw new NotFoundException('Comprobante no encontrado.');
    return x[0];
  }
  async void(id: string, actorId: string, reason: string) {
    this.id(id);
    if (
      typeof reason !== 'string' ||
      reason.trim().length < 10 ||
      reason.trim().length > 255
    )
      throw new BadRequestException(
        'El motivo debe contener entre 10 y 255 caracteres.',
      );
    return serializable(this.db, async (tx) => {
      const rows = await tx.$queryRawUnsafe<AnyRow[]>(
        'SELECT p.*,r.number FROM payments p JOIN receipts r ON r.payment_id=p.id WHERE p.id=$1::uuid FOR UPDATE',
        id,
      );
      const p = rows[0];
      if (!p) throw new NotFoundException('Pago no encontrado.');
      if (p.status !== 'PAGADO')
        throw new ConflictException('Solo pueden anularse cobros PAGADO.');
      validatePaymentVoid({
        paymentId: id,
        status: p.status,
        reason,
        actorId,
        actorRole: 'RECEPCION_ADMIN',
      });
      const now = this.clock.now();
      await tx.$executeRawUnsafe(
        "UPDATE payments SET status='ANULADO',void_reason=$2,voided_at=$3,voided_by_id=$4::uuid,updated_at=$3 WHERE id=$1::uuid",
        id,
        reason.trim(),
        now,
        actorId,
      );
      const fresh = await tx.$queryRawUnsafe<AnyRow[]>(
        "SELECT amount_usd FROM payments WHERE member_id=$1::uuid AND concept=$2 AND status='PENDIENTE' ORDER BY created_at DESC LIMIT 1",
        p.member_id,
        p.concept,
      );
      const amount = fresh[0]?.amount_usd ?? p.amount_usd;
      const next = await tx.$queryRawUnsafe<AnyRow[]>(
        "INSERT INTO payments(id,member_id,concept,amount_usd,status,due_date,created_at,updated_at) VALUES(gen_random_uuid(),$1::uuid,$2,$3,'PENDIENTE',$4::date + interval '3 days',$5,$5) RETURNING id",
        p.member_id,
        p.concept,
        amount,
        this.clock.today(),
        now,
      );
      await this.event(
        tx,
        id,
        p.member_id,
        'Cobro anulado',
        p.concept,
        p.amount_usd,
      );
      return {
        paymentId: id,
        status: 'ANULADO',
        voidedAt: now.toISOString(),
        newPaymentId: next[0].id,
      };
    });
  }
  private async event(
    tx: any,
    id: string,
    member: string,
    title: string,
    concept: string,
    amount: any,
  ) {
    await tx.$executeRawUnsafe(
      "INSERT INTO domain_events(type,aggregate_id,recipient_id,payload,dedupe_key,created_at) VALUES('PAGOS',$1::uuid,$2::uuid,$3::jsonb,$4,$5) ON CONFLICT(dedupe_key) DO NOTHING",
      member,
      member,
      JSON.stringify({
        module: 'PAGOS',
        title,
        message: `${concept}: USD ${Number(amount).toFixed(2)}`,
      }),
      `${title}:${id}`,
      this.clock.now(),
    );
  }
  async receiptPdf(receiptId: string, userId: string, role: string) {
    this.id(receiptId);
    if (!['MIEMBRO', 'RECEPCION_ADMIN'].includes(role))
      throw new (await import('@nestjs/common')).ForbiddenException(
        'Acceso denegado.',
      );
    const rows = await this.query(
      'SELECT r.number,p.member_id,p.concept,p.amount_usd,p.status,p.method,p.paid_at,p.void_reason,COALESCE(up.full_name,u.email) AS name FROM receipts r JOIN payments p ON p.id=r.payment_id JOIN users u ON u.id=p.member_id LEFT JOIN user_profiles up ON up.user_id=u.id WHERE r.id=$1::uuid',
      receiptId,
    );
    const p = rows[0];
    if (!p || (role === 'MIEMBRO' && p.member_id !== userId))
      throw new NotFoundException('Comprobante no encontrado.');
    const summary = prepareReceipt({
      number: Number(p.number),
      memberName: p.name,
      concept: p.concept,
      amountUsd: Number(p.amount_usd),
      status: p.status,
      issuedAt: p.paid_at,
    });
    const lines = [
      `Comprobante ${summary.receiptNumber}`,
      `Miembro: ${summary.memberName}`,
      `Concepto: ${summary.concept}`,
      `Monto: ${summary.amount}`,
      `Método: ${p.method}`,
      `Fecha: ${summary.issuedAt}`,
      `Estado: ${summary.status}${p.status === 'ANULADO' ? ' - ANULADO' : ''}`,
      ...(p.void_reason ? [`Motivo: ${p.void_reason}`] : []),
    ];
    return pdf(lines);
  }
}
function pdf(lines: string[]) {
  const safe = (s: string) =>
    s
      .normalize('NFKD')
      .replace(/[^\x20-\x7E]/g, '?')
      .replace(/[()\\]/g, '\\$&');
  const text = lines
    .map((l, i) => `BT /F1 12 Tf 50 ${780 - i * 24} Td (${safe(l)}) Tj ET`)
    .join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
  ];
  let out = '%PDF-1.4\n',
    offsets = [0];
  for (let i = 0; i < objs.length; i++) {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const x = Buffer.byteLength(out);
  out +=
    `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)
      .join('') +
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(out, 'ascii');
}
