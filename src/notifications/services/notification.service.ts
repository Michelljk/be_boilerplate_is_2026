import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationModule } from '@PrismaClient';
import type { Prisma } from '@PrismaClient';
import {
  NotificationsRepository,
  type NotificationDraft,
  type NotificationRow,
} from '../repositories/index.js';

/** Techo de destinatarios por llamada (H35, entrada `memberIds: uuid[] (1..200)`). */
export const MAX_RECIPIENTS = 200;
/** Tamaño de página de la bandeja (H34). */
export const NOTIFICATION_PAGE_SIZE = 20;
/** Tope de `pageSize` en la bandeja, igual que en los demás listados. */
const MAX_PAGE_SIZE = 50;

const MODULES = Object.values(NotificationModule) as string[];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface NotificationInput {
  memberIds: string[];
  module: NotificationModule;
  title: string;
  message: string;
  referenceId?: string | null;
  dedupeKey?: string | null;
}

export interface NotificationSendResult {
  created: number;
  skipped: number;
}

export interface NotificationListQuery {
  module?: NotificationModule;
  unread?: boolean;
  page?: number;
  pageSize?: number;
}

export interface NotificationPage {
  items: NotificationRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Servicio común de avisos (H35) y bandeja del miembro (H34).
 *
 * Ningún otro dominio escribe en `notifications`: todos llaman a `send`, dentro
 * de su propia transacción cuando el aviso debe atarse al hecho que lo origina.
 * La deduplicación por `(miembro, dedupeKey)` hace que reejecutar una tarea o
 * procesar dos veces un evento no duplique el aviso.
 */
@Injectable()
export class NotificationService {
  constructor(private readonly repo: NotificationsRepository) {}

  /** Crea una notificación `NO_LEIDA` por destinatario y devuelve el recuento. */
  async send(
    input: NotificationInput,
    tx?: Prisma.TransactionClient,
  ): Promise<NotificationSendResult> {
    this.assertInput(input);
    const recipients = [...new Set(input.memberIds)];
    const known = await this.repo.findRecipients(recipients, tx);
    if (known.length !== recipients.length) {
      throw new BadRequestException({
        code: 'NO_RECIPIENTS',
        field: 'memberIds',
      });
    }

    const drafts: NotificationDraft[] = recipients.map((memberId) => ({
      memberId,
      module: input.module,
      title: input.title,
      message: input.message,
      referenceId: input.referenceId ?? null,
      dedupeKey: input.dedupeKey ?? null,
    }));

    const write = (client: Prisma.TransactionClient) =>
      this.repo.insertMany(drafts, client);
    const created = tx ? await write(tx) : await this.repo.transaction(write);
    return { created, skipped: recipients.length - created };
  }

  /** Bandeja ordenada de la más reciente a la más antigua. */
  async list(memberId: string, query: NotificationListQuery): Promise<NotificationPage> {
    if (query.module !== undefined && !MODULES.includes(query.module as string)) {
      throw new BadRequestException({ code: 'MODULE_INVALID', field: 'module' });
    }
    const page = this.pageOf(query.page);
    const pageSize = this.pageSizeOf(query.pageSize);
    const { rows, total } = await this.repo.list(memberId, {
      module: query.module,
      unread: query.unread,
      page,
      pageSize,
    });
    return { items: rows, total, page, pageSize };
  }

  /** Contador del ícono de notificaciones (H34 criterio 3). */
  async unreadCount(memberId: string): Promise<{ count: number }> {
    return { count: await this.repo.countUnread(memberId) };
  }

  /**
   * Marca como leída.
   *
   * Ya leída responde 200 sin cambios (criterio 6) y una id de otro miembro
   * responde 404 (criterio 5), sin distinguir si el registro existe.
   */
  async markRead(
    memberId: string,
    id: string,
  ): Promise<{ success: true; alreadyRead: boolean }> {
    const changed = await this.repo.markUnreadAsRead(memberId, id);
    if (changed > 0) {
      return { success: true, alreadyRead: false };
    }
    if (!(await this.repo.owns(memberId, id))) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        field: 'id',
      });
    }
    return { success: true, alreadyRead: true };
  }

  private pageOf(value: number | undefined): number {
    const page = Math.trunc(Number(value ?? 1));
    if (!Number.isFinite(page) || page < 1) {
      throw new BadRequestException({ code: 'PAGE_INVALID', field: 'page' });
    }
    return page;
  }

  /** El tamaño de página admitido va de 1 a 50; por defecto 20 (H34). */
  private pageSizeOf(value: number | undefined): number {
    const size = Math.trunc(Number(value ?? NOTIFICATION_PAGE_SIZE));
    if (!Number.isFinite(size) || size < 1 || size > MAX_PAGE_SIZE) {
      throw new BadRequestException({ code: 'PAGE_SIZE_INVALID', field: 'pageSize' });
    }
    return size;
  }

  private assertInput(input: NotificationInput): void {
    if (
      !Array.isArray(input.memberIds) ||
      input.memberIds.length === 0 ||
      input.memberIds.length > MAX_RECIPIENTS
    ) {
      throw new BadRequestException({ code: 'NO_RECIPIENTS', field: 'memberIds' });
    }
    if (input.memberIds.some((id) => !UUID_PATTERN.test(id))) {
      throw new BadRequestException({ code: 'NO_RECIPIENTS', field: 'memberIds' });
    }
    if (!MODULES.includes(input.module as string)) {
      throw new BadRequestException({ code: 'MODULE_INVALID', field: 'module' });
    }
    if (this.isBlank(input.title) || input.title.length > 100) {
      throw new BadRequestException({ code: 'TITLE_INVALID', field: 'title' });
    }
    if (this.isBlank(input.message) || input.message.length > 500) {
      throw new BadRequestException({ code: 'MESSAGE_INVALID', field: 'message' });
    }
    if (input.dedupeKey !== undefined && input.dedupeKey !== null && input.dedupeKey.length > 100) {
      throw new BadRequestException({ code: 'DEDUPE_KEY_INVALID', field: 'dedupeKey' });
    }
    if (
      input.referenceId !== undefined &&
      input.referenceId !== null &&
      !UUID_PATTERN.test(input.referenceId)
    ) {
      throw new BadRequestException({ code: 'REFERENCE_INVALID', field: 'referenceId' });
    }
  }

  private isBlank(value: string | undefined): boolean {
    return value === undefined || value.trim().length === 0;
  }
}
