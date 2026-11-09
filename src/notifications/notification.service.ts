import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';

export interface NotificationInput {
  memberIds: string[];
  module: 'MEMBRESIAS' | 'RESERVAS' | 'PAGOS' | 'SISTEMA';
  title: string;
  message: string;
  referenceId?: string;
  dedupeKey?: string;
}

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}
  async send(input: NotificationInput, client?: any) {
    this.validate(input);
    const db: any = client ?? this.prisma;
    const run = async (tx: any) => {
      const users = await tx.user.findMany({ where: { id: { in: input.memberIds }, role: 'MIEMBRO' }, select: { id: true } });
      if (users.length !== input.memberIds.length) throw new NotFoundException('UNKNOWN_RECIPIENT');
      const existing = input.dedupeKey ? await tx.notification.findMany({ where: { memberId: { in: input.memberIds }, dedupeKey: input.dedupeKey }, select: { memberId: true } }) : [];
      const already = new Set(existing.map((x: any) => x.memberId));
      const pending = input.memberIds.filter((id) => !already.has(id));
      if (!pending.length) return { created: 0, skipped: input.memberIds.length, ids: [] };
      const result = await tx.notification.createMany({ data: pending.map((memberId) => ({ memberId, module: input.module, title: input.title, message: input.message, referenceId: input.referenceId, dedupeKey: input.dedupeKey, status: 'NO_LEIDA' })) });
      const created = await tx.notification.findMany({ where: { memberId: { in: pending }, ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}) }, select: { id: true } });
      return { created: result.count, skipped: input.memberIds.length - result.count, ids: created.map((x: any) => x.id) };
    };
    return client ? run(db) : this.prisma.$transaction(run);
  }
  private validate(input: NotificationInput) {
    if (!Array.isArray(input.memberIds) || input.memberIds.length < 1 || input.memberIds.length > 200) throw new BadRequestException({ code: 'NO_RECIPIENTS', field: 'memberIds' });
    if (!['MEMBRESIAS', 'RESERVAS', 'PAGOS', 'SISTEMA'].includes(input.module)) throw new BadRequestException({ code: 'MODULE_INVALID', field: 'module' });
    if (!input.title || input.title.length > 100) throw new BadRequestException({ code: 'TITLE_INVALID', field: 'title' });
    if (!input.message || input.message.length > 500) throw new BadRequestException({ code: 'MESSAGE_INVALID', field: 'message' });
    if (input.dedupeKey && input.dedupeKey.length > 100) throw new BadRequestException({ code: 'DEDUPE_KEY_INVALID', field: 'dedupeKey' });
  }
}
