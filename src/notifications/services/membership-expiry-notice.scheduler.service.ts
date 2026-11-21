import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import cron from 'node-cron';
import { PrismaService } from '@Prisma/services';
import { PaymentStatus, Prisma } from '@PrismaClient';
import {
  EXPIRY_DAILY_CRON,
  EXPIRY_THRESHOLDS_DAYS,
  membershipExpiryNotice,
} from '../domain/notification-templates.js';
import { GYM_TIME_ZONE, toCivilTime } from '../domain/gym-time.js';
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
 * node-cron dispara una vez al día a las 06:00 civiles en la zona del
 * gimnasio. La clave `VENC-<membresía>-<umbral>` hace idempotente una
 * reejecución y el filtro SQL sólo considera membresías vigentes, incluidos
 * todos los planes por clases independientemente de sus créditos restantes.
 */
@Injectable()
export class MembershipExpiryNoticeScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MembershipExpiryNoticeScheduler.name);
  private task?: ReturnType<typeof cron.schedule>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit(): void {
    this.task = cron.schedule(
      EXPIRY_DAILY_CRON,
      () => void this.runScheduled(),
      { timezone: GYM_TIME_ZONE },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.task?.stop();
    this.task = undefined;
  }

  private async runScheduled(): Promise<void> {
    try {
      const sent = await this.run();
      if (sent > 0) {
        this.logger.log(`H31: ${sent} avisos de vencimiento creados.`);
      }
    } catch (error) {
      this.logger.error(
        'H31: la tanda de avisos falló; se intentará en la próxima ejecución programada.',
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
   * Membresías pagadas que siguen VIGENTE y vencen en un umbral. La membresía
   * más nueva del miembro desplaza la anterior y evita avisos después de renovar.
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
        AND m.status = 'VIGENTE'::"MembershipStatus"
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
