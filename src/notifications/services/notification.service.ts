import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

export type NotificationValidationCode =
  | 'NO_RECIPIENTS'
  | 'UNKNOWN_RECIPIENT'
  | 'TITLE_INVALID'
  | 'MESSAGE_INVALID'
  | 'MODULE_INVALID'
  | 'DEDUPE_KEY_INVALID'
  | 'REFERENCE_INVALID';

/**
 * Error de entrada del servicio interno H35.
 *
 * No es una excepción HTTP: el módulo llamador decide cómo traducirla a 400,
 * mientras que los campos públicos permiten conservar el mismo contrato en
 * llamadas HTTP, tareas programadas y transacciones de dominio.
 */
export class NotificationValidationError extends Error {
  readonly name = 'NotificationValidationError';

  constructor(
    readonly code: NotificationValidationCode,
    message: string,
    readonly field: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

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
  ids: string[];
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
 * La deduplicación por `(miembro, dedupeKey)` hace que reejecutar una tarea no
 * duplique el aviso.
 */
@Injectable()
export class NotificationService {
  constructor(private readonly repo: NotificationsRepository) {}

  /** Crea notificaciones `NO_LEIDA` y devuelve el recuento, omisiones e IDs. */
  async send(
    input: NotificationInput,
    tx?: Prisma.TransactionClient,
  ): Promise<NotificationSendResult> {
    this.assertInput(input);

    const write = async (
      client: Prisma.TransactionClient,
    ): Promise<NotificationSendResult> => {
      const recipients = [...new Set(input.memberIds)];
      const known = await this.repo.findRecipients(recipients, client);
      if (known.length !== recipients.length) {
        throw new NotificationValidationError(
          'UNKNOWN_RECIPIENT',
          'Uno o más destinatarios no existen o no tienen rol MIEMBRO.',
          'memberIds',
        );
      }

      const drafts: NotificationDraft[] = recipients.map((memberId) => ({
        memberId,
        module: input.module,
        title: input.title,
        message: input.message,
        referenceId: input.referenceId ?? null,
        dedupeKey: input.dedupeKey ?? null,
      }));
      const inserted = await this.repo.insertMany(drafts, client);
      return {
        created: inserted.created,
        skipped: recipients.length - inserted.created,
        ids: inserted.ids,
      };
    };

    // La validación de destinatarios y la inserción deben observar la misma
    // transacción. Así una llamada sin tx tampoco deja una ventana de carrera.
    return tx ? write(tx) : this.repo.transaction(write);
  }

  /** Bandeja ordenada de la más reciente a la más antigua. */
  async list(
    memberId: string,
    query: NotificationListQuery,
  ): Promise<NotificationPage> {
    if (
      query.module !== undefined &&
      !MODULES.includes(query.module as string)
    ) {
      throw new BadRequestException({
        code: 'MODULE_INVALID',
        field: 'module',
      });
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
      throw new BadRequestException({
        code: 'PAGE_SIZE_INVALID',
        field: 'pageSize',
      });
    }
    return size;
  }

  private assertInput(input: NotificationInput): void {
    if (
      !Array.isArray(input.memberIds) ||
      input.memberIds.length === 0 ||
      input.memberIds.length > MAX_RECIPIENTS
    ) {
      throw new NotificationValidationError(
        'NO_RECIPIENTS',
        'Debe indicar entre 1 y 200 destinatarios.',
        'memberIds',
      );
    }
    if (
      input.memberIds.some(
        (id) => typeof id !== 'string' || !UUID_PATTERN.test(id),
      )
    ) {
      throw new NotificationValidationError(
        'NO_RECIPIENTS',
        'Todos los destinatarios deben ser UUID válidos.',
        'memberIds',
      );
    }
    if (!MODULES.includes(input.module as string)) {
      throw new NotificationValidationError(
        'MODULE_INVALID',
        'El módulo de origen no pertenece al enum de notificaciones.',
        'module',
      );
    }
    if (
      typeof input.title !== 'string' ||
      this.isBlank(input.title) ||
      input.title.length > 100
    ) {
      throw new NotificationValidationError(
        'TITLE_INVALID',
        'El título debe tener entre 1 y 100 caracteres.',
        'title',
      );
    }
    if (
      typeof input.message !== 'string' ||
      this.isBlank(input.message) ||
      input.message.length > 500
    ) {
      throw new NotificationValidationError(
        'MESSAGE_INVALID',
        'El mensaje debe tener entre 1 y 500 caracteres.',
        'message',
      );
    }
    if (
      input.dedupeKey !== undefined &&
      input.dedupeKey !== null &&
      (typeof input.dedupeKey !== 'string' || input.dedupeKey.length > 100)
    ) {
      throw new NotificationValidationError(
        'DEDUPE_KEY_INVALID',
        'La clave de deduplicación no puede superar 100 caracteres.',
        'dedupeKey',
      );
    }
    if (
      input.referenceId !== undefined &&
      input.referenceId !== null &&
      (typeof input.referenceId !== 'string' ||
        !UUID_PATTERN.test(input.referenceId))
    ) {
      throw new NotificationValidationError(
        'REFERENCE_INVALID',
        'La referencia debe ser un UUID válido.',
        'referenceId',
      );
    }
  }

  private isBlank(value: string): boolean {
    return value.trim().length === 0;
  }
}
