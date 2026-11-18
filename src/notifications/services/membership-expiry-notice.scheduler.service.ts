import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { PaymentStatus, Prisma } from '@PrismaClient';
import {
  EXPIRY_DAILY_CRON,
  EXPIRY_THRESHOLDS_DAYS,
  membershipExpiryNotice,
} from '../domain/notification-templates.js';
import {
  nextRunAt,
  parseDailyCron,
  toCivilTime,
} from '../domain/gym-time.js';
import { NotificationService } from './notification.service.js';

interface ExpiringMembership {
  membershipId: string;
  memberId: string;
  planName: string;
  endsOn: string;
  daysLeft: number;
}

/**
 * Aviso de vencimiento de membresía (H31).
 *
 * Corre una vez al día a las 06:00 civiles y busca las membresas pagadas que
 * vencen justo en los umbrales de 7 y 1 día. La clave `VENC-<membresa>-<umbral>`
 * hace que reejecutar la tarea el mismo día no duplique el aviso, criterio 4 de
 * la historia.
 */
@Injectable()
export class MembershipExpiryNoticeScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MembershipExpiryNoticeScheduler.name);
  private readonly schedule = parseDailyCron(EXPIRY_DAILY_CRON);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit(): void {
    void this.runIfDue('arranque');
    this.arm();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  /** Vuelve a programarse tras cada ejecución, en la zona del gimnasio. */
  private arm(now: Date = new Date()): void {
    const next = nextRunAt(this.schedule, now);
    this.timer = setTimeout(() => {
      void this.runIfDue('programada');
      this.arm(new Date());
    }, Math.max(1_000, next.getTime() - now.getTime()));
    this.timer.unref();
  }

  /**
   * En el arranque sólo se actúa si efectivamente es la hora de la tanda, para
   * no mandar avisos fuera de ventana cuando el servicio se reinicia a media
   * tarde.
   */
  private async runIfDue(reason: string): Promise<void> {
    const now = new Date();
    const civil = toCivilTime(now);
    if (reason === 'arranque' && (civil.hour !== this.schedule.hour || civil.minute > this.schedule.minute)) {
      return;
    }
    try {
      const sent = await this.run(now);
      if (sent > 0) {
        this.logger.log(`H31: ${sent} avisos de vencimiento enviados.`);
      }
    } catch (error) {
      this.logger.error(
        'H31: la tanda de avisos falló; se reintenta en la próxima ventana.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Ejecuta la tanda y devuelve cuántos avisos se crearon. */
  async run(now: Date = new Date()): Promise<number> {
    const today = toCivilTime(now).date;
    const targets = await this.findExpiring(today);
    let created = 0;
    for (const target of targets) {
      const notice = membershipExpiryNotice(
        target.membershipId,
        target.planName,
        target.endsOn,
        target.daysLeft,
      );
      const result = await this.notifications.send({
        memberIds: [target.memberId],
        module: notice.module,
        title: notice.title,
        message: notice.message,
        referenceId: target.membershipId,
        dedupeKey: notice.dedupeKey,
      });
      created += result.created;
    }
    return created;
  }

  /**
   * Membresas cuyo cobro está PAGADO y vencen en los umbrales, ignorando a
   * quien ya renovó (criterio 3: la cobertura nueva desplaza el aviso).
   */
  private findExpiring(today: string): Promise<ExpiringMembership[]> {
    const thresholds = EXPIRY_THRESHOLDS_DAYS.map((days) => days);
    return this.prisma.$queryRaw<ExpiringMembership[]>(Prisma.sql`
      SELECT
        m.id                                            AS "membershipId",
        m.member_id                                     AS "memberId",
        p.name                                          AS "planName",
        to_char(m.ends_on, 'YYYY-MM-DD')                AS "endsOn",
        (m.ends_on::date - ${today}::date)::int         AS "daysLeft"
      FROM memberships m
      JOIN membership_plans p ON p.id = m.plan_id
      JOIN payments pay ON pay.id = m.payment_id
      WHERE pay.status = ${PaymentStatus.PAGADO}::"PaymentStatus"
        AND pay.concept = 'MEMBRESIA'
        AND m.starts_on::date <= ${today}::date
        AND m.ends_on::date - ${today}::date = ANY(${thresholds}::int[])
        AND NOT EXISTS (
          SELECT 1
          FROM memberships newer
          WHERE newer.member_id = m.member_id
            AND newer.starts_on > m.starts_on
        )
      ORDER BY m.ends_on ASC, m.id ASC
    `);
  }
}
