import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { NotificationService } from '../../notifications/notification.service.js';

const ROLES = { member: 'MIEMBRO', admin: 'RECEPCION_ADMIN' } as const;
const iso = (d: Date) => d.toISOString();
const dateOnly = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Fecha inválida.');
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Fecha inválida.');
  return d;
};
const uuid = (value: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new BadRequestException('UUID inválido.');
};
const createSimplePdf = (text: string): Buffer => {
  const escaped = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const stream = `BT /F1 11 Tf 50 760 Td 14 TL (${escaped.replace(/\n/g, ') T* (')}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n%GKDS\n'; const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) { offsets.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf, 'latin1'); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`; return Buffer.from(pdf, 'latin1');
};

const addPlanDuration = (start: Date, plan: any) => {
  const end = new Date(start);
  if (plan.type === 'BY_CLASSES') end.setUTCDate(end.getUTCDate() + (plan.durationDays ?? 0));
  else end.setUTCMonth(end.getUTCMonth() + (plan.durationMonths ?? 0));
  end.setUTCDate(end.getUTCDate() - 1);
  return end;
};

@Injectable()
export class GkdsService {
  constructor(private readonly prisma: PrismaService, private readonly notificationService: NotificationService) {}
  private db(): any { return this.prisma as any; }

  /** Punto compartido para H5 y cualquier reserva que necesite validar membresía. */
  async assertMemberEligible(memberId: string) {
    const row = await this.db().membership.findFirst({ where: { memberId }, include: { plan: true }, orderBy: { endsOn: 'desc' } });
    if (!row || this.membershipStatus(row) !== 'VIGENTE') throw new ConflictException('La membresía no está vigente.');
    if (row.plan.type === 'BY_CLASSES' && (row.creditsRemaining ?? 0) < 1) throw new ConflictException('No tienes clases disponibles.');
    return row;
  }
  async membership(me: string) {
    const row = await this.db().membership.findFirst({ where: { memberId: me }, include: { plan: true }, orderBy: { endsOn: 'desc' } });
    if (!row) return { membership: null };
    const status = this.membershipStatus(row);
    if (row.status !== status) await this.db().membership.update({ where: { id: row.id }, data: { status } });
    return { membership: { id: row.id, planId: row.planId, planName: row.plan.name, benefits: Array.isArray(row.plan.benefits) ? row.plan.benefits : [], startsOn: row.startsOn.toISOString().slice(0, 10), endsOn: row.endsOn.toISOString().slice(0, 10), planType: row.plan.type, creditsRemaining: row.creditsRemaining, status } };
  }
  private membershipStatus(row: any): 'VIGENTE' | 'VENCIDA' {
    const now = new Date();
    return row.startsOn <= now && row.endsOn >= now && (row.plan.type !== 'BY_CLASSES' || (row.creditsRemaining ?? 0) > 0) ? 'VIGENTE' : 'VENCIDA';
  }
  async createPlan(data: any) {
    this.validatePlan(data);
    try {
      const p = await this.db().membershipPlan.create({ data: { name: data.name.trim(), type: data.type, priceUsd: Number(data.priceUsd).toFixed(2), durationMonths: data.type === 'BY_CLASSES' ? null : Number(data.durationMonths), durationDays: data.type === 'BY_CLASSES' ? Number(data.durationDays) : null, classCredits: data.type === 'BY_CLASSES' ? Number(data.classCredits) : null, benefits: data.benefits ?? [], status: data.status ?? 'ACTIVO' } });
      return this.planDto(p);
    } catch (e: any) { if (e?.code === 'P2002') throw new ConflictException('Ya existe un plan con ese nombre.'); throw e; }
  }
  async updatePlan(id: string, data: any) {
    uuid(id);
    const current = await this.db().membershipPlan.findUnique({ where: { id } }); if (!current) throw new NotFoundException('Plan inexistente.');
    const merged = { ...current, ...data }; this.validatePlan(merged, true);
    try {
      const p = await this.db().membershipPlan.update({ where: { id }, data: { ...(data.name !== undefined ? { name: data.name.trim() } : {}), ...(data.type !== undefined ? { type: data.type } : {}), ...(data.priceUsd !== undefined ? { priceUsd: Number(data.priceUsd).toFixed(2) } : {}), ...(data.durationMonths !== undefined ? { durationMonths: data.type === 'BY_CLASSES' ? null : Number(data.durationMonths) } : {}), ...(data.durationDays !== undefined ? { durationDays: data.type === 'BY_CLASSES' ? Number(data.durationDays) : null } : {}), ...(data.classCredits !== undefined ? { classCredits: data.type === 'BY_CLASSES' ? Number(data.classCredits) : null } : {}), ...(data.benefits !== undefined ? { benefits: data.benefits } : {}), ...(data.status !== undefined ? { status: data.status } : {}) } });
      return this.planDto(p);
    } catch (e: any) { if (e?.code === 'P2002') throw new ConflictException('Ya existe un plan con ese nombre.'); throw e; }
  }
  private planDto(p: any) { return { id: p.id, name: p.name, type: p.type, priceUsd: p.priceUsd.toString(), durationMonths: p.durationMonths, durationDays: p.durationDays, classCredits: p.classCredits, benefits: p.benefits, status: p.status }; }
  private validatePlan(data: any, partial = false) {
    if (!partial && (!data.name || data.name.trim().length < 3 || data.name.trim().length > 80)) throw new BadRequestException('El nombre debe tener entre 3 y 80 caracteres.');
    if (data.name !== undefined && (data.name.trim().length < 3 || data.name.trim().length > 80)) throw new BadRequestException('El nombre debe tener entre 3 y 80 caracteres.');
    if (!['MONTHLY', 'QUARTERLY', 'BY_CLASSES'].includes(data.type)) throw new BadRequestException('Tipo de plan inválido.');
    if (Number(data.priceUsd) < 0 || !Number.isFinite(Number(data.priceUsd))) throw new BadRequestException('El precio no puede ser negativo.');
    if (data.type === 'BY_CLASSES') { if (!Number.isInteger(Number(data.classCredits)) || Number(data.classCredits) < 1 || !Number.isInteger(Number(data.durationDays)) || Number(data.durationDays) < 1) throw new BadRequestException('Un plan por clases requiere créditos y días válidos.'); }
    else if (!Number.isInteger(Number(data.durationMonths)) || Number(data.durationMonths) < 1) throw new BadRequestException('La duración en meses debe ser al menos 1.');
    if (!Array.isArray(data.benefits) || data.benefits.some((x: any) => typeof x !== 'string')) throw new BadRequestException('Los beneficios deben ser una lista de textos.');
    if (data.status !== undefined && !['ACTIVO', 'INACTIVO'].includes(data.status)) throw new BadRequestException('Estado de plan inválido.');
  }
  async plans(status?: string) {
    if (status && !['ACTIVO', 'INACTIVO'].includes(status)) throw new BadRequestException('Estado de plan inválido.');
    const rows = await this.db().membershipPlan.findMany({ where: status ? { status } : {}, orderBy: { name: 'asc' } });
    return { data: rows.map((p: any) => ({ id: p.id, name: p.name, priceUsd: p.priceUsd.toString(), type: p.type, durationMonths: p.durationMonths, durationDays: p.durationDays, classCredits: p.classCredits, benefits: p.benefits, status: p.status })) };
  }
  async purchase(adminId: string, data: any) {
    uuid(data.planId);
    if (!data.memberNumber || String(data.memberNumber).length > 30) throw new BadRequestException('memberNumber es obligatorio.');
    const member = await this.db().user.findUnique({ where: { memberNumber: data.memberNumber } });
    if (!member) throw new NotFoundException('Miembro no encontrado.');
    const plan = await this.db().membershipPlan.findUnique({ where: { id: data.planId } });
    if (!plan) throw new NotFoundException('Plan inexistente.');
    if (plan.status !== 'ACTIVO') throw new ConflictException('El plan seleccionado no está disponible');
    const active = await this.db().membership.findFirst({ where: { memberId: member.id }, include: { plan: true } });
    if (active && this.membershipStatus(active) === 'VIGENTE') throw new ConflictException('El miembro ya tiene una membresía vigente. Seleccione la opción Renovación');
    return this.db().$transaction(async (tx: any) => {
      const payment = await tx.payment.create({ data: { memberId: member.id, concept: 'MEMBRESIA', amountUsd: plan.priceUsd, dueDate: new Date(Date.now() + 3 * 86400000) } });
      const request = await tx.membershipRequest.create({ data: { memberId: member.id, planId: plan.id, paymentId: payment.id, operation: 'COMPRA' } });
      return { requestId: request.id, paymentId: payment.id, status: 'PENDIENTE_PAGO', startsOn: null, endsOn: null };
    });
  }
  async renewal(adminId: string, membershipId: string, data: any) {
    uuid(membershipId); uuid(data.planId);
    const membership = await this.db().membership.findUnique({ where: { id: membershipId }, include: { plan: true } });
    const plan = await this.db().membershipPlan.findUnique({ where: { id: data.planId } });
    if (!membership || !plan) throw new NotFoundException('Membresía o plan inexistente.');
    if (plan.status !== 'ACTIVO') throw new ConflictException('El plan seleccionado no está disponible');
    const pending = await this.db().membershipRequest.findFirst({ where: { membershipId, status: 'PENDIENTE_PAGO' } });
    if (pending) throw new ConflictException('Ya existe una renovación pendiente.');
    return this.db().$transaction(async (tx: any) => {
      const payment = await tx.payment.create({ data: { memberId: membership.memberId, concept: 'MEMBRESIA', amountUsd: plan.priceUsd, dueDate: new Date(Date.now() + 3 * 86400000) } });
      const request = await tx.membershipRequest.create({ data: { memberId: membership.memberId, membershipId, planId: plan.id, paymentId: payment.id, operation: 'RENOVACION' } });
      const currentValid = this.membershipStatus(membership) === 'VIGENTE';
      const expectedStart = currentValid ? new Date(membership.endsOn.getTime() + 86400000) : new Date();
      return { requestId: request.id, membershipId, paymentId: payment.id, status: 'PENDIENTE_PAGO', expectedEndsOn: addPlanDuration(expectedStart, plan).toISOString().slice(0, 10) };
    });
  }

  async searchMembers(q: string) {
    if (!q || q.length < 2 || q.length > 80) throw new BadRequestException('La búsqueda debe tener entre 2 y 80 caracteres.');
    const rows = await this.db().user.findMany({ where: { role: 'MIEMBRO', OR: [{ memberNumber: { contains: q, mode: 'insensitive' } }, { fullName: { contains: q, mode: 'insensitive' } }] }, take: 20, orderBy: { fullName: 'asc' }, include: { memberships: { include: { plan: true }, orderBy: { endsOn: 'desc' }, take: 1 } } });
    return { data: rows.map((m: any) => { const membership = m.memberships[0]; const status = membership ? this.membershipStatus(membership) : null; return { memberId: m.id, memberNumber: m.memberNumber, memberName: m.fullName || m.email, membership: { status: status ?? 'SIN_MEMBRESIA', endsOn: membership?.endsOn.toISOString().slice(0, 10) ?? null } }; }) };
  }
  async checkIn(adminId: string, data: any) {
    uuid(data.memberId);
    const member = await this.db().user.findUnique({ where: { id: data.memberId }, include: { memberships: { include: { plan: true }, orderBy: { endsOn: 'desc' }, take: 1 } } });
    if (!member) throw new NotFoundException('No se encontró al miembro');
    const now = new Date(); const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const membership = member.memberships[0]; const membershipStatus = membership ? this.membershipStatus(membership) : 'SIN_MEMBRESIA';
    const confirmed = Boolean(data.confirmExpired);
    if (membershipStatus !== 'VIGENTE' && !confirmed) throw new ConflictException({ code: 'MEMBRESIA_VENCIDA', message: 'Membresía vencida: confirma para registrar el ingreso' });
    try {
      const row = await this.db().checkIn.create({ data: { memberId: member.id, registeredById: adminId, checkInDate: day, checkedInAt: now, membershipStatus, expiredConfirmed: membershipStatus !== 'VIGENTE' && confirmed } });
      return { id: row.id, memberNumber: member.memberNumber, memberName: member.fullName || member.email, checkedInAt: iso(row.checkedInAt), membershipStatus: row.membershipStatus, expiredConfirmed: row.expiredConfirmed };
    } catch (e: any) { if (e?.code === 'P2002') throw new ConflictException('El miembro ya registró su ingreso hoy'); throw e; }
  }
  async checkInHistory(query: any) {
    const now = new Date(); const from = query.from ? dateOnly(query.from) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29)); const to = query.to ? dateOnly(query.to) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    if (from > to) throw new BadRequestException('La fecha inicial no puede ser posterior a la final');
    if ((to.getTime() - from.getTime()) / 86400000 > 90) throw new BadRequestException('El rango no puede superar 90 días');
    const page = Math.max(1, Number(query.page) || 1); const pageSize = Math.min(20, Math.max(1, Number(query.pageSize) || 20));
    const where: any = { checkInDate: { gte: from, lte: to } }; if (query.memberNumber) where.member = { memberNumber: query.memberNumber };
    const [rows, total] = await Promise.all([this.db().checkIn.findMany({ where, include: { member: true }, orderBy: [{ checkedInAt: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }), this.db().checkIn.count({ where })]);
    return { data: rows.map((r: any) => ({ id: r.id, memberNumber: r.member.memberNumber, memberName: r.member.fullName || r.member.email, checkedInAt: iso(r.checkedInAt), membershipStatus: r.membershipStatus, expiredConfirmed: r.expiredConfirmed })), total, page, pageSize };
  }

  async pendingMine(memberId: string) { const rows = await this.db().payment.findMany({ where: { memberId, status: 'PENDIENTE' }, orderBy: { dueDate: 'asc' } }); return { data: rows.map((p: any) => this.paymentDto(p)) }; }
  private paymentDto(p: any) { return { id: p.id, concept: p.concept, amountUsd: p.amountUsd.toString(), dueDate: p.dueDate.toISOString().slice(0, 10) }; }
  async payCard(memberId: string, id: string, data: any) {
    uuid(id); if (!/^\d{16}$/.test(data.cardNumber ?? '') || !/^\d{3}$/.test(data.cvv ?? '') || !/^\d{2}\/\d{2}$/.test(data.expiry ?? '') || String(data.holder ?? '').length < 2) throw new BadRequestException('Datos de tarjeta inválidos.');
    if (!data.cardNumber.endsWith('4242')) throw new BadRequestException({ code: 'PAYMENT_DECLINED', message: 'Pago rechazado: tarjeta no aprobada' });
    return this.finalizePayment(memberId, id, 'TARJETA', data.cardNumber.slice(-4), `SIM-${Date.now()}`);
  }
  private async finalizePayment(memberId: string, id: string, method: string, cardLast4?: string, gatewayRef?: string) {
    return this.db().$transaction(async (tx: any) => {
      const p = await tx.payment.findUnique({ where: { id }, include: { receipt: true } });
      if (!p || p.memberId !== memberId) throw new NotFoundException('Pago inexistente.');
      if (p.status !== 'PENDIENTE') throw new ConflictException('El pago ya fue procesado.');
      const paidAt = new Date(); const updated = await tx.payment.update({ where: { id }, data: { status: 'PAGADO', method, cardLast4, gatewayRef, paidAt } });
      const max = await tx.receipt.aggregate({ _max: { number: true } }); const receipt = await tx.receipt.create({ data: { paymentId: id, number: (max._max.number ?? 0) + 1 } });
      if (p.membershipRequest) await this.applyMembership(tx, p.id, paidAt);
      return { paymentId: id, status: 'PAGADO', amountUsd: updated.amountUsd.toString(), paidAt: iso(paidAt), receiptNumber: `C-${String(receipt.number).padStart(6, '0')}`, cardLast4, gatewayRef };
    });
  }
  private async applyMembership(tx: any, paymentId: string, paidAt: Date) {
    const request = await tx.membershipRequest.findUnique({ where: { paymentId }, include: { plan: true, membership: true } }); if (!request || request.status !== 'PENDIENTE_PAGO') return;
    const previous = request.membership; const currentValid = previous && previous.startsOn <= paidAt && previous.endsOn >= paidAt && (request.plan.type !== 'BY_CLASSES' || (previous.creditsRemaining ?? 0) > 0); const start = currentValid ? new Date(previous.endsOn.getTime() + 86400000) : paidAt; const end = addPlanDuration(start, request.plan); const credits = request.plan.type === 'BY_CLASSES' ? (currentValid ? (previous?.creditsRemaining ?? 0) : 0) + (request.plan.classCredits ?? 0) : null;
    const membership = previous ? await tx.membership.update({ where: { id: previous.id }, data: { planId: request.planId, startsOn: currentValid ? previous.startsOn : start, endsOn: end, creditsRemaining: credits, status: 'VIGENTE' } }) : await tx.membership.create({ data: { memberId: request.memberId, planId: request.planId, startsOn: start, endsOn: end, creditsRemaining: credits, status: 'VIGENTE' } });
    await tx.membershipRequest.update({ where: { id: request.id }, data: { membershipId: membership.id, status: 'APLICADA', appliedAt: paidAt } });
  }
  async receiptPdf(user: any, id: string) {
    uuid(id); const row = await this.db().receipt.findUnique({ where: { id }, include: { payment: { include: { member: true } } } }); if (!row) throw new NotFoundException('Comprobante inexistente.'); if (user.role === ROLES.member && row.payment.memberId !== user.id) throw new NotFoundException('Comprobante inexistente.');
    const title = `Comprobante C-${String(row.number).padStart(6, '0')}`; const body = `${title}\nMiembro: ${row.payment.member.fullName || row.payment.member.email}\nConcepto: ${row.payment.concept}\nMonto USD: ${row.payment.amountUsd}\nEstado: ${row.payment.status}\nFecha: ${row.issuedAt.toISOString()}`; return createSimplePdf(body);
  }
  async memberPayments(id: string) { uuid(id); const member = await this.db().user.findUnique({ where: { id } }); if (!member) throw new NotFoundException('Miembro no encontrado.'); return { data: await this.pendingForMember(id, 'PENDIENTE') }; }
  private async pendingForMember(memberId: string, status: string) { const rows = await this.db().payment.findMany({ where: { memberId, status }, orderBy: { dueDate: 'asc' } }); return rows.map((p: any) => this.paymentDto(p)); }
  async collect(adminId: string, id: string, data: any) { if (!['EFECTIVO', 'TARJETA'].includes(data.method)) throw new BadRequestException('Método de pago inválido.'); if (data.method === 'TARJETA') { if (!/^\d{16}$/.test(data.cardNumber ?? '') || !String(data.cardNumber).endsWith('4242')) throw new BadRequestException({ code: 'PAYMENT_DECLINED', message: 'Pago rechazado: tarjeta no aprobada' }); return this.finalizePaymentForAdmin(id, 'TARJETA', data.cardNumber.slice(-4), `SIM-${Date.now()}`); } return this.finalizePaymentForAdmin(id, 'EFECTIVO'); }
  private async finalizePaymentForAdmin(id: string, method: string, cardLast4?: string, gatewayRef?: string) { const p = await this.db().payment.findUnique({ where: { id } }); if (!p) throw new NotFoundException('Pago inexistente.'); return this.finalizePayment(p.memberId, id, method, cardLast4, gatewayRef); }
  async pendingAll(query: any) { const allowed = ['MEMBRESIA', 'SESION_ADICIONAL', 'SESION_PERSONAL']; if (query.concept && !allowed.includes(query.concept)) throw new BadRequestException('Concepto inválido.'); const page = Math.max(1, Number(query.page) || 1); const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20)); const rows = await this.db().payment.findMany({ where: { status: 'PENDIENTE', ...(query.concept ? { concept: query.concept } : {}) }, include: { member: true }, orderBy: [{ dueDate: 'asc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }); const total = await this.db().payment.count({ where: { status: 'PENDIENTE', ...(query.concept ? { concept: query.concept } : {}) } }); const today = new Date(); return { data: rows.map((p: any) => ({ paymentId: p.id, memberNumber: p.member.memberNumber, memberName: p.member.fullName || p.member.email, concept: p.concept, amountUsd: p.amountUsd.toString(), dueDate: p.dueDate.toISOString().slice(0, 10), daysOverdue: Math.max(0, Math.floor((today.getTime() - p.dueDate.getTime()) / 86400000)) })), total, page, pageSize }; }
  async findPaymentByReceipt(receiptNumber: string) { if (!/^C-\d{6}$/.test(receiptNumber)) throw new BadRequestException('Formato de comprobante inválido.'); const row = await this.db().receipt.findUnique({ where: { number: Number(receiptNumber.slice(2)) }, include: { payment: { include: { member: true } } } }); if (!row) throw new NotFoundException('Comprobante inexistente.'); return { paymentId: row.paymentId, memberName: row.payment.member.fullName || row.payment.member.email, concept: row.payment.concept, amountUsd: row.payment.amountUsd.toString(), status: row.payment.status, paidAt: row.payment.paidAt ? iso(row.payment.paidAt) : null }; }
  async voidPayment(adminId: string, id: string, data: any) { uuid(id); if (!data.reason || data.reason.length < 10 || data.reason.length > 255) throw new BadRequestException('El motivo debe tener entre 10 y 255 caracteres.'); return this.db().$transaction(async (tx: any) => { const p = await tx.payment.findUnique({ where: { id }, include: { membershipRequest: true } }); if (!p) throw new NotFoundException('Pago inexistente.'); if (p.status !== 'PAGADO') throw new ConflictException('Solo se pueden anular pagos PAGADO.'); const now = new Date(); const old = await tx.payment.update({ where: { id }, data: { status: 'ANULADO', voidReason: data.reason, voidedAt: now, voidedById: adminId } }); const fresh = await tx.payment.create({ data: { memberId: p.memberId, concept: p.concept, amountUsd: p.amountUsd, dueDate: new Date(now.getTime() + 3 * 86400000) } }); if (p.membershipRequest) await tx.membership.updateMany({ where: { memberId: p.memberId, status: 'VIGENTE' }, data: { status: 'VENCIDA' } }); await this.notificationService.send({ memberIds: [p.memberId], module: 'PAGOS', title: 'Cobro anulado', message: `Se anuló el cobro ${p.concept} por USD ${p.amountUsd}.`, referenceId: p.id, dedupeKey: `ANUL-${p.id}` }, tx); return { paymentId: old.id, status: 'ANULADO', voidedAt: iso(now), newPaymentId: fresh.id }; }); }
}
