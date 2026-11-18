import { NotificationModule } from '@PrismaClient';
import { formatCivilDate, formatGymDateTime } from './gym-time.js';

/** Umbrales exigidos por H31: siete días y un día antes del vencimiento. */
export const EXPIRY_THRESHOLDS_DAYS = [7, 1] as const;
/** Ventanilla diaria del aviso: 06:00 civiles, formato admitido por el dominio. */
export const EXPIRY_DAILY_CRON = '0 6 * * *';

export interface NotificationContent {
  module: NotificationModule;
  title: string;
  message: string;
  dedupeKey: string;
}

/** Texto del criterio 1 de H31, con la fecha en `dd/mm/aaaa`. */
export function membershipExpiryNotice(
  membershipId: string,
  planName: string,
  endsOn: string,
  thresholdDays: number,
): NotificationContent {
  return {
    module: NotificationModule.MEMBRESIAS,
    title: 'Tu membresía vence pronto',
    message: `Tu plan ${planName} vence el ${formatCivilDate(endsOn)}. Renuévalo para no perder el acceso.`,
    dedupeKey: `VENC-${membershipId}-${thresholdDays}`,
  };
}

/** Texto del criterio 1 de H32 cuando RECEPCION_ADMIN cancela la sesión (H7). */
export function classCancelledNotice(
  sessionId: string,
  className: string,
  startsAt: Date | string,
  cancelReason?: string | null,
): NotificationContent {
  const when = formatGymDateTime(new Date(startsAt));
  const reason = cancelReason ? `. Motivo: ${cancelReason}` : '.';
  return {
    module: NotificationModule.RESERVAS,
    title: 'Clase cancelada',
    message: `La clase ${className} del ${when.date} a las ${when.time} fue cancelada${reason}`,
    dedupeKey: `CANC-${sessionId}`,
  };
}

/** Textos de H33: confirmación y cancelación de la propia reserva. */
export function reservationNotice(
  reservationId: string,
  className: string,
  startsAt: Date | string,
  cancelled: boolean,
): NotificationContent {
  const when = formatGymDateTime(new Date(startsAt));
  return cancelled
    ? {
        module: NotificationModule.RESERVAS,
        title: 'Reserva cancelada',
        message: `Cancelaste tu reserva para ${className} del ${when.date} a las ${when.time}. El cupo fue liberado.`,
        dedupeKey: `RES-CANCEL-${reservationId}`,
      }
    : {
        module: NotificationModule.RESERVAS,
        title: 'Reserva confirmada',
        message: `Tu reserva para ${className} del ${when.date} a las ${when.time} fue confirmada.`,
        dedupeKey: `RES-CONF-${reservationId}`,
      };
}
