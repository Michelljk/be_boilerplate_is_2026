import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import {
  NotificationModule,
  NotificationStatus,
  Prisma,
  UserRole,
} from '@PrismaClient';

export interface NotificationDraft {
  memberId: string;
  module: NotificationModule;
  title: string;
  message: string;
  referenceId: string | null;
  dedupeKey: string | null;
}

export interface NotificationListFilter {
  module?: NotificationModule;
  unread?: boolean;
  page: number;
  pageSize: number;
}

const LIST_SELECT = {
  id: true,
  module: true,
  title: true,
  message: true,
  referenceId: true,
  status: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

export type NotificationRow = Prisma.NotificationGetPayload<{
  select: typeof LIST_SELECT;
}>;

/** Único acceso a la tabla `notifications`; los demás módulos sólo llaman al servicio (H35). */
@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Destinatarios que existen, son miembros y están activos. */
  findRecipients(
    memberIds: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<string[]> {
    const db = tx ?? this.prisma;
    return db.user
      .findMany({
        where: { id: { in: memberIds }, role: UserRole.MIEMBRO, isActive: true },
        select: { id: true },
      })
      .then((rows) => rows.map((row) => row.id));
  }

  /**
   * Inserta una notificación por destinatario.
   *
   * `skipDuplicates` respeta el índice único que compara miembro y clave de
   * deduplicación, que es lo que vuelve reejecutable el aviso de vencimiento
   * (H31) y la confirmación de reserva (H33).
   */
  insertMany(
    drafts: NotificationDraft[],
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    if (drafts.length === 0) {
      return Promise.resolve(0);
    }
    return tx.notification
      .createMany({ data: drafts, skipDuplicates: true })
      .then((result) => result.count);
  }

  /** Bandeja (H34) con filtro de módulo y de no leídas. */
  async list(
    memberId: string,
    filter: NotificationListFilter,
  ): Promise<{ rows: NotificationRow[]; total: number }> {
    const where: Prisma.NotificationWhereInput = {
      memberId,
      ...(filter.module ? { module: filter.module } : {}),
      ...(filter.unread === undefined
        ? {}
        : {
            status: filter.unread
              ? NotificationStatus.NO_LEIDA
              : NotificationStatus.LEIDA,
          }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        select: LIST_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { rows, total };
  }

  countUnread(memberId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { memberId, status: NotificationStatus.NO_LEIDA },
    });
  }

  /**
   * Marca como leída sólo si sigue sin leer (H34 criterio 6): la segunda
   * chamada no escribe nada y responde igual de bien.
   */
  markUnreadAsRead(memberId: string, id: string): Promise<number> {
    return this.prisma.notification
      .updateMany({
        where: { id, memberId, status: NotificationStatus.NO_LEIDA },
        data: { status: NotificationStatus.LEIDA, readAt: new Date() },
      })
      .then((result) => result.count);
  }

  /** Pertencia del registro: una id de otro miembro debe responder 404. */
  owns(memberId: string, id: string): Promise<boolean> {
    return this.prisma.notification
      .findFirst({ where: { id, memberId }, select: { id: true } })
      .then((row) => row !== null);
  }

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }
}
