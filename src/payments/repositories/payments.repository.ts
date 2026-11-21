import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/services/prisma.service.js';
import { GymClock } from '../../common/time/gym-clock.service.js';
import { prepareReceipt } from '../../gkds/comprobantes/receipt-format.js';
import { serializable } from '../../common/repositories/serializable.js';
import { validateCollection } from '../../gkds/recepcion/collect-payment.js';
import { validatePaymentVoid } from '../../gkds/anulaciones/payment-void-validation.js';
import {
  simulateH16Card,
  validateH16Card,
} from '../payment-card-simulation.js';
import { MembershipsService } from '../../memberships/services/index.js';
import { NotificationService } from '../../notifications/services/notification.service.js';
import { SESSION_AMOUNT_USD } from '../../personal-sessions/domain/session-rules.js';
import { ADDITIONAL_SESSION_REPLACEMENT_USD } from '../domain/payment-pricing.js';
import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONCEPTS = ['MEMBRESIA', 'SESION_ADICIONAL', 'SESION_PERSONAL'];
const LOCAL_DUE_DATE =
  "(p.due_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/El_Salvador')::date";
type AnyRow = Record<string, any>;

type MembershipPaymentOperations = MembershipsService & {
  getReplacementAmountTx(tx: unknown, paymentId: string): Promise<string>;
  reversePaidRequestTx(
    tx: unknown,
    oldPaymentId: string,
    newPaymentId: string,
    actorId: string,
    now: Date,
  ): Promise<void>;
};

@Injectable()
export class PaymentsRepository {
  constructor(
    private readonly db: PrismaService,
    private readonly clock: GymClock,
    private readonly memberships: MembershipsService,
    @Optional() private readonly notifications?: NotificationService,
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
        `SELECT id,concept,to_char(amount_usd,'FM999999990.00') AS "amountUsd",
          to_char(due_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/El_Salvador','YYYY-MM-DD') AS "dueDate"
         FROM payments
         WHERE member_id=$1::uuid AND status='PENDIENTE'
         ORDER BY due_date,id`,
        memberId,
      ),
    };
  }

  async memberPending(memberId: string, status: string) {
    this.id(memberId);
    if (status !== 'PENDIENTE') {
      throw new BadRequestException('El estado debe ser PENDIENTE.');
    }
    const member = await this.query(
      "SELECT id FROM users WHERE id=$1::uuid AND role='MIEMBRO'",
      memberId,
    );
    if (!member.length) throw new NotFoundException('Miembro no encontrado.');
    return this.myPending(memberId);
  }

  async payCard(id: string, memberId: string, body: unknown) {
    this.id(id);
    return serializable(this.db, async (tx) => {
      // La existencia, propiedad y estado se resuelven antes de validar o simular
      // la tarjeta; así un recurso inexistente/ajeno nunca se filtra como 400.
      const rows = await tx.$queryRawUnsafe<AnyRow[]>(
        'SELECT * FROM payments WHERE id=$1::uuid FOR UPDATE',
        id,
      );
      const p = rows[0];
      if (!p || p.member_id !== memberId)
        throw new NotFoundException('Pago no encontrado.');
      if (p.status !== 'PENDIENTE')
        throw new ConflictException('El pago ya fue procesado.');

      const card = validateH16Card(body);
      const ref = await simulateH16Card(card.cardNumber);
      const paidAt = this.clock.now();
      const last4 = card.cardNumber.slice(-4);
      const updated = await tx.$queryRawUnsafe<AnyRow[]>(
        "UPDATE payments SET status='PAGADO',method='TARJETA',paid_at=$2,card_last4=$3,gateway_ref=$4,updated_at=$2 WHERE id=$1::uuid AND status='PENDIENTE' RETURNING *",
        id,
        paidAt,
        last4,
        ref,
      );
      if (!updated.length) throw new ConflictException('Cobro simultáneo.');
      if (p.concept === 'MEMBRESIA') {
        await this.memberships.applyPaidRequestTx(tx, id, paidAt);
      }
      const rec = await this.makeReceipt(tx, updated[0]);
      await this.notify(
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
        amountUsd: formatUsd(p.amount_usd),
        paidAt: paidAt.toISOString(),
        receiptNumber: rec.receiptNumber,
        cardLast4: last4,
        gatewayRef: ref,
      };
    });
  }

  async collect(id: string, actorId: string, body: unknown) {
    this.id(id);
    return serializable(this.db, async (tx) => {
      // Igual que H16: no se ejecuta simulación ni validación de tarjeta hasta
      // confirmar que el pago existe y sigue PENDIENTE.
      const r = await tx.$queryRawUnsafe<AnyRow[]>(
        'SELECT * FROM payments WHERE id=$1::uuid FOR UPDATE',
        id,
      );
      const p = r[0];
      if (!p) throw new BadRequestException('Pago no encontrado.');
      if (p.status !== 'PENDIENTE')
        throw new ConflictException('El pago ya fue procesado.');

      const request = collectionRequest(body);
      const ref =
        request.method === 'TARJETA'
          ? await simulateH16Card(request.card.cardNumber)
          : null;
      const last =
        request.method === 'TARJETA' ? request.card.cardNumber.slice(-4) : null;
      validateCollection({
        paymentId: id,
        status: p.status,
        amountUsd: Number(p.amount_usd),
        method: request.method,
        cardLast4: last ?? undefined,
      });
      const now = this.clock.now();
      const u = await tx.$queryRawUnsafe<AnyRow[]>(
        "UPDATE payments SET status='PAGADO',method=$2,paid_at=$3,registered_by_id=$4::uuid,card_last4=$5,gateway_ref=$6,updated_at=$3 WHERE id=$1::uuid AND status='PENDIENTE' RETURNING *",
        id,
        request.method,
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
      await this.notify(
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
        method: request.method,
        amountUsd: formatUsd(p.amount_usd),
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
      "INSERT INTO receipts(payment_id,number,method,issued_at) VALUES($1::uuid,nextval('receipt_number_seq'),$2,$3) RETURNING id,number,issued_at",
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
      issuedAt: r[0].issued_at,
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
      cond.push(
        `p.paid_at >= (($${args.length}::date AT TIME ZONE 'America/El_Salvador') AT TIME ZONE 'UTC')`,
      );
    }
    if (to) {
      args.push(to);
      cond.push(
        `p.paid_at < ((($${args.length}::date + interval '1 day') AT TIME ZONE 'America/El_Salvador') AT TIME ZONE 'UTC')`,
      );
    }
    const where = cond.join(' AND ');
    const count = await this.query(
      `SELECT count(*)::int n FROM payments p WHERE ${where}`,
      ...args,
    );
    args.push(size, (page - 1) * size);
    const data = await this.query(
      `SELECT p.id AS "paymentId",r.id AS "receiptId",p.paid_at AS "paidAt",p.concept,to_char(p.amount_usd,'FM999999990.00') AS "amountUsd",p.status,p.void_reason AS reason FROM payments p LEFT JOIN receipts r ON r.payment_id=p.id WHERE ${where} ORDER BY p.paid_at DESC NULLS LAST,p.id LIMIT $${args.length - 1} OFFSET $${args.length}`,
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
    const day = this.clock.today();
    const cond = ["p.status='PENDIENTE'"],
      filterArgs: unknown[] = [];
    if (q.concept) {
      filterArgs.push(q.concept);
      cond.push(`p.concept=$${filterArgs.length}`);
    }
    let dueDayPlaceholder: string | undefined;
    if (q.overdue) {
      filterArgs.push(day);
      dueDayPlaceholder = `$${filterArgs.length}::date`;
      const due = `GREATEST(0,(${dueDayPlaceholder} - ${LOCAL_DUE_DATE}))`;
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
    const where = cond.join(' AND ');
    const count = await this.query(
      `SELECT count(*)::int n FROM payments p WHERE ${where}`,
      ...filterArgs,
    );
    const dataArgs = [...filterArgs];
    if (!dueDayPlaceholder) {
      dataArgs.push(day);
      dueDayPlaceholder = `$${dataArgs.length}::date`;
    }
    const due = `GREATEST(0,(${dueDayPlaceholder} - ${LOCAL_DUE_DATE}))`;
    const localDue = LOCAL_DUE_DATE;
    dataArgs.push(size, (page - 1) * size);
    const data = await this.query(
      `SELECT p.id AS "paymentId",mp.member_number AS "memberNumber",COALESCE(up.full_name,u.email) AS "memberName",p.concept,to_char(p.amount_usd,'FM999999990.00') AS "amountUsd",to_char(${localDue},'YYYY-MM-DD') AS "dueDate",${due}::int AS "daysOverdue" FROM payments p JOIN users u ON u.id=p.member_id LEFT JOIN member_profiles mp ON mp.user_id=u.id LEFT JOIN user_profiles up ON up.user_id=u.id WHERE ${where} ORDER BY "daysOverdue" DESC,"dueDate",p.id LIMIT $${dataArgs.length - 1} OFFSET $${dataArgs.length}`,
      ...dataArgs,
    );
    return { data, total: count[0].n, page, pageSize: size };
  }

  async voidSearch(receiptNumber: string) {
    if (!/^C-\d{6}$/.test(receiptNumber ?? ''))
      throw new BadRequestException('Formato de comprobante inválido.');
    const x = await this.query(
      `SELECT p.id AS "paymentId",COALESCE(up.full_name,u.email) AS "memberName",p.concept,to_char(p.amount_usd,'FM999999990.00') AS "amountUsd",p.status,p.paid_at AS "paidAt" FROM receipts r JOIN payments p ON p.id=r.payment_id JOIN users u ON u.id=p.member_id LEFT JOIN user_profiles up ON up.user_id=u.id WHERE r.number=substring($1 from 3)::int`,
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
        'SELECT p.*,r.number FROM payments p LEFT JOIN receipts r ON r.payment_id=p.id WHERE p.id=$1::uuid FOR UPDATE OF p',
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
      const membershipOps = this.memberships as MembershipPaymentOperations;
      const membershipAmount =
        p.concept === 'MEMBRESIA'
          ? await membershipOps.getReplacementAmountTx(tx, id)
          : null;
      const amount = replacementPaymentAmount(
        p.concept,
        membershipAmount,
        p.amount_usd,
      );
      await tx.$executeRawUnsafe(
        "UPDATE payments SET status='ANULADO',void_reason=$2,voided_at=$3,voided_by_id=$4::uuid,updated_at=$3 WHERE id=$1::uuid",
        id,
        reason.trim(),
        now,
        actorId,
      );
      const next = await tx.$queryRawUnsafe<AnyRow[]>(
        "INSERT INTO payments(id,member_id,concept,amount_usd,status,due_date,created_at,updated_at) VALUES(gen_random_uuid(),$1::uuid,$2,$3,'PENDIENTE',((($4::date + interval '3 days') AT TIME ZONE 'America/El_Salvador') AT TIME ZONE 'UTC'),$5,$5) RETURNING id",
        p.member_id,
        p.concept,
        amount,
        this.clock.today(),
        now,
      );
      if (p.concept === 'MEMBRESIA') {
        await membershipOps.reversePaidRequestTx(
          tx,
          id,
          next[0].id,
          actorId,
          now,
        );
      }
      await this.notify(
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

  private async notify(
    tx: any,
    paymentId: string,
    memberId: string,
    title: string,
    concept: string,
    amount: unknown,
  ) {
    if (!this.notifications) {
      throw new Error(
        'NotificationService no está disponible en PaymentsModule.',
      );
    }
    await this.notifications.send(
      {
        memberIds: [memberId],
        module: 'PAGOS' as any,
        title,
        message: `${concept}: USD ${formatUsd(amount)}`,
        referenceId: paymentId,
        dedupeKey: `${title}:${paymentId}`,
      },
      tx,
    );
  }

  async receiptPdf(receiptId: string, userId: string, role: string) {
    this.id(receiptId);
    if (!['MIEMBRO', 'RECEPCION_ADMIN'].includes(role))
      throw new (await import('@nestjs/common')).ForbiddenException(
        'Acceso denegado.',
      );
    const rows = await this.query(
      'SELECT r.number,r.issued_at,p.member_id,p.concept,p.amount_usd,p.status,p.method,p.void_reason,COALESCE(up.full_name,u.email) AS name FROM receipts r JOIN payments p ON p.id=r.payment_id JOIN users u ON u.id=p.member_id LEFT JOIN user_profiles up ON up.user_id=u.id WHERE r.id=$1::uuid',
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
      issuedAt: p.issued_at,
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

function formatUsd(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount))
    throw new BadRequestException('Monto inválido.');
  return amount.toFixed(2);
}

/** Precios usados exclusivamente al crear el pago sustituto H21. Los pagos
 * históricos permanecen inalterados; MEMBRESIA y SESION_PERSONAL usan sus
 * fuentes canónicas y SESION_ADICIONAL su tarifa provisional central.
 */
export function replacementPaymentAmount(
  concept: string,
  membershipAmount: string | null,
  _previousAmount: unknown,
): string {
  if (concept === 'MEMBRESIA') {
    if (membershipAmount === null) {
      throw new BadRequestException('No se encontró tarifa vigente de membresía.');
    }
    return formatUsd(membershipAmount);
  }
  if (concept === 'SESION_PERSONAL') return SESSION_AMOUNT_USD.toFixed(2);
  if (concept === 'SESION_ADICIONAL')
    return ADDITIONAL_SESSION_REPLACEMENT_USD;
  throw new BadRequestException('Concepto de pago no reconocido.');
}

function collectionRequest(body: unknown): {
  method: 'EFECTIVO' | 'TARJETA';
  card: ReturnType<typeof validateH16Card>;
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Solicitud de cobro inválida.');
  }
  const raw = body as Record<string, unknown>;
  if (raw.method !== 'EFECTIVO' && raw.method !== 'TARJETA') {
    throw new BadRequestException('Solicitud de cobro inválida.');
  }
  const allowed =
    raw.method === 'TARJETA'
      ? ['method', 'cardNumber', 'holder', 'expiry', 'cvv']
      : ['method'];
  if (Object.keys(raw).some((key) => !allowed.includes(key))) {
    throw new BadRequestException('Solicitud de cobro inválida.');
  }
  if (raw.method === 'EFECTIVO') {
    return { method: 'EFECTIVO', card: undefined as never };
  }
  const card = validateH16Card({
    cardNumber: raw.cardNumber,
    holder: raw.holder,
    expiry: raw.expiry,
    cvv: raw.cvv,
  });
  return { method: 'TARJETA', card };
}

function pdf(lines: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
    const unicodeFont = fileURLToPath(
      new URL('../../../assets/fonts/DejaVuSans.ttf', import.meta.url),
    );
    if (existsSync(unicodeFont)) {
      document.registerFont('ReceiptUnicode', unicodeFont);
      document.font('ReceiptUnicode');
    } else {
      document.font('Helvetica');
    }
    document.fontSize(12);
    lines.forEach((line) => document.text(line));
    document.end();
  });
}
