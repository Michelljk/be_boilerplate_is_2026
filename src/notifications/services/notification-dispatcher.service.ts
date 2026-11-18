import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { Prisma } from '@PrismaClient';
import {
  classCancelledNotice,
  reservationNotice,
  type NotificationContent,
} from '../domain/notification-templates.js';
import { NotificationService } from './notification.service.js';

/** Las referencias de bandeja sólo se exponen si son identificadores válidos. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Eventos que este dominio sabe traducir en avisos de bandeja. */
const HANDLED_EVENTS = [
  'CLASS_SESSION_CANCELLED',
  'CLASS_RESERVATION_CONFIRMED',
  'CLASS_RESERVATION_CANCELLED',
] as const;

/** Lote por tanda: acota el trabajo de un ciclo si la cola crece. */
const BATCH_SIZE = 100;
const POLL_INTERVAL_MS = 5_000;

interface OutboxEvent {
  id: string;
  type: string;
  recipientId: string | null;
  payload: Prisma.JsonValue;
}

type EventPayload = Record<string, unknown>;

/**
 * Traduce la mesa de eventos (`domain_events`) en notificaciones.
 *
 * Los módulos productores sólo insertan el evento dentro de su transacción
 * (H32, H33); aquí se lee, se envía y se marca como procesado. Un evento
 * mal formado se marca igualmente para que no envenene la cola: reintentarlo
 * no lo haría válido y bloquearía los avisos de los demás miembros.
 */
@Injectable()
export class NotificationDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDispatcher.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.dispatch(), POLL_INTERVAL_MS);
    this.timer.unref();
    void this.dispatch();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /** Un ciclo de cola; se ignora si el anterior aún no termina. */
  async dispatch(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const events = await this.pendingEvents();
      for (const event of events) {
        try {
          await this.process(event);
        } catch (error) {
          this.logger.error(
            `No se pudo procesar el evento ${event.id}.`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'No se pudo leer la cola de eventos de dominio.',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  private pendingEvents(): Promise<OutboxEvent[]> {
    return this.prisma.domainEvent.findMany({
      where: { processedAt: null, type: { in: [...HANDLED_EVENTS] } },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
      select: { id: true, type: true, recipientId: true, payload: true },
    }) as Promise<OutboxEvent[]>;
  }

  private async process(event: OutboxEvent): Promise<void> {
    const payload = (event.payload ?? {}) as EventPayload;

    if (!event.recipientId) {
      this.logger.warn(`Evento ${event.id} sin destinatario; se descarta.`);
      await this.markProcessed(event.id);
      return;
    }

    const startsAt = this.instantOf(payload.startsAt);
    if (!startsAt) {
      this.logger.warn(
        `Evento ${event.id} sin fecha de inicio válida; se descarta.`,
      );
      await this.markProcessed(event.id);
      return;
    }

    const content = this.buildContent(event, payload, startsAt);
    try {
      await this.notifications.send({
        memberIds: [event.recipientId],
        module: content.module,
        title: content.title,
        message: content.message,
        dedupeKey: content.dedupeKey,
        referenceId: this.referenceOf(event, payload),
      });
      await this.markProcessed(event.id);
    } catch (error) {
      this.logger.error(
        `No se pudo notificar el evento ${event.id} (${event.type}).`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private buildContent(
    event: OutboxEvent,
    payload: EventPayload,
    startsAt: Date,
  ): NotificationContent {
    const className = this.text(payload.className) ?? 'la clase';
    if (event.type === 'CLASS_SESSION_CANCELLED') {
      const sessionId =
        this.text(payload.sessionId) ?? this.text(payload.reservationId) ?? event.id;
      const reason = this.text(payload.cancelReason);
      return classCancelledNotice(
        sessionId,
        className,
        startsAt,
        reason && reason.length > 0 ? reason : null,
      );
    }
    const reservationId =
      this.text(payload.reservationId) ?? this.text(payload.sessionId) ?? event.id;
    return reservationNotice(
      reservationId,
      className,
      startsAt,
      event.type === 'CLASS_RESERVATION_CANCELLED',
    );
  }

  /** La referencia que abre la pantalla relacionada desde la bandeja. */
  private referenceOf(event: OutboxEvent, payload: EventPayload): string | null {
    const key =
      event.type === 'CLASS_SESSION_CANCELLED' ? 'sessionId' : 'reservationId';
    const value = this.text(payload[key]);
    return value && UUID_PATTERN.test(value) ? value : null;
  }

  private instantOf(value: unknown): Date | null {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'string' && value.length > 0) {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  private text(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private markProcessed(id: string): Promise<unknown> {
    return this.prisma.domainEvent.update({
      where: { id },
      data: { processedAt: new Date() },
    });
  }
}
