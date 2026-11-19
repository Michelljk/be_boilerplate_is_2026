import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { GymClock } from '@Common/time';
import { MembershipsService } from './memberships.service.js';

/** Hora civil del gimnasio (America/El_Salvador, sin horario de verano). */
const RUN_HOUR_LOCAL = 6;
/** El calendario de El Salvador es UTC-6 de forma permanente. */
const LOCAL_OFFSET_HOURS = -6;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Job diario de vencimientos (H1/H31).
 *
 * Pasa a `VENCIDA` las membresas que la regla canónica ya no habilita, para que
 * el estado persistido coincida con el que devuelve `GET /memberships/me` y con
 * el listado que consulta el aviso de vencimiento. Es idempotente: sólo toca
 * filas que hoy están `VIGENTE`.
 */
@Injectable()
export class MembershipExpiryScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MembershipExpiryScheduler.name);
  private timer?: NodeJS.Timeout;
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly service: MembershipsService,
    private readonly clock: GymClock,
  ) {}

  async onModuleInit(): Promise<void> {
    // Un servicio recién levantado puede haberse perdido la ventana del día;
    // la ejecución inmediata es segura por la idempotencia del filtro.
    await this.run('arranque');
    this.schedule();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    await Promise.allSettled(this.inFlight);
  }

  /** Próxima ejecución a las 06:00 civiles, calculada sobre el reloj de El Salvador. */
  private schedule(): void {
    const delay = this.msToNextRun(this.clock.now());
    this.timer = setTimeout(() => {
      void this.run('programada');
      this.schedule();
    }, delay);
    this.timer.unref();
    this.logger.log(
      `Vencimientos diarios en ${Math.round(delay / 60000)} min.`,
    );
  }

  private msToNextRun(now: Date): number {
    const localNow = new Date(now.getTime() + LOCAL_OFFSET_HOURS * HOUR_MS);
    const nextLocal = new Date(
      Date.UTC(
        localNow.getUTCFullYear(),
        localNow.getUTCMonth(),
        localNow.getUTCDate(),
        RUN_HOUR_LOCAL,
      ),
    );
    if (nextLocal.getTime() <= localNow.getTime()) {
      nextLocal.setUTCDate(nextLocal.getUTCDate() + 1);
    }
    return nextLocal.getTime() - localNow.getTime();
  }

  private run(reason: string): Promise<void> {
    const execution = this.execute(reason);
    this.inFlight.add(execution);
    void execution.finally(() => this.inFlight.delete(execution));
    return execution;
  }

  private async execute(reason: string): Promise<void> {
    try {
      const expired = await this.service.expireOverdue();
      if (expired > 0) {
        this.logger.log(
          `Membresías marcadas como vencidas (${reason}): ${expired}.`,
        );
      }
    } catch (error) {
      // Un fallo del job no puede derribar la API: se reintenta en la siguiente ventana.
      this.logger.error(
        `No se pudo aplicar el vencimiento diario (${reason}).`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
