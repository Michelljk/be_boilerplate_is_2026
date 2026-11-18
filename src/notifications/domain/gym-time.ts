import { addDays, isCalendarDate } from '@Common/time';

/** Zona civil del gimnasio; los instantes se guardan en UTC. */
export const GYM_TIME_ZONE = 'America/El_Salvador';

const HOURS_PER_DAY = 24;
const MINUTE_MAX = 59;
const HOUR_MAX = 23;
const CRON_FIELDS = 5;
const OFFSET_CORRECTION_STEPS = 3;

const civilFormatters = new Map<string, Intl.DateTimeFormat>();

export interface CivilTime {
  date: string;
  hour: number;
  minute: number;
}

export interface DailySchedule {
  minute: number;
  hour: number;
}

export interface GymDateTime {
  date: string;
  time: string;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function civilFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = civilFormatters.get(timeZone);
  if (cached) {
    return cached;
  }
  const created = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  civilFormatters.set(timeZone, created);
  return created;
}

function partOf(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  return parts.find((part) => part.type === type)?.value ?? '00';
}

function stampOf(civil: CivilTime): string {
  const hour = civil.hour % HOURS_PER_DAY;
  return `${civil.date}T${pad(hour)}:${pad(civil.minute)}:00.000Z`;
}

/** Hora civil (fecha + hora + minuto) de un instante en la zona indicada. */
export function toCivilTime(
  instant: Date,
  timeZone: string = GYM_TIME_ZONE,
): CivilTime {
  const parts = civilFormatter(timeZone).formatToParts(instant);
  return {
    date: `${partOf(parts, 'year')}-${partOf(parts, 'month')}-${partOf(parts, 'day')}`,
    hour: Number(partOf(parts, 'hour')),
    minute: Number(partOf(parts, 'minute')),
  };
}

/**
 * Instante UTC que corresponde a una hora civil.
 *
 * Se resuelve corrigiendo el desfase sucesivamente en lugar de suponer un
 * offset fijo, así sigue siendo correcto aunque la zona adoptara DST.
 */
export function fromCivilTime(
  civil: CivilTime,
  timeZone: string = GYM_TIME_ZONE,
): Date {
  const target = Date.parse(stampOf(civil));
  if (!Number.isFinite(target)) {
    throw new Error(`Hora civil inválida: ${stampOf(civil)}`);
  }
  let instant = target;
  for (let step = 0; step < OFFSET_CORRECTION_STEPS; step++) {
    const wall = Date.parse(stampOf(toCivilTime(new Date(instant), timeZone)));
    const drift = target - wall;
    if (drift === 0) {
      break;
    }
    instant += drift;
  }
  return new Date(instant);
}

/**
 * Analiza la única forma de cron que admite este dominio: un horario diario
 * `M H * * *`. Cualquier otra expresión se rechaza en el arranque, nunca se
 * interpreta a medias.
 */
export function parseDailyCron(expression: string): DailySchedule {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== CRON_FIELDS) {
    throw new Error(`Expresión cron inválida: ${expression}`);
  }
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  for (const field of [dayOfMonth, month, dayOfWeek]) {
    if (field !== '*') {
      throw new Error(
        `Solo se admiten ejecuciones diarias (* en día, mes y semana): ${expression}`,
      );
    }
  }
  return {
    minute: parseField(minute, MINUTE_MAX, 'minuto', expression),
    hour: parseField(hour, HOUR_MAX, 'hora', expression),
  };
}

function parseField(
  field: string,
  maximum: number,
  label: string,
  expression: string,
): number {
  if (!/^\d+$/.test(field)) {
    throw new Error(
      `El campo ${label} de ${expression} debe ser un número exacto.`,
    );
  }
  const value = Number(field);
  if (value > maximum) {
    throw new Error(
      `El campo ${label} de ${expression} debe estar entre 0 y ${maximum}.`,
    );
  }
  return value;
}

/** Próxima ejecución estrictamente posterior a `from`. */
export function nextRunAt(
  schedule: DailySchedule,
  from: Date,
  timeZone: string = GYM_TIME_ZONE,
): Date {
  const current = toCivilTime(from, timeZone);
  const today = fromCivilTime(
    { date: current.date, hour: schedule.hour, minute: schedule.minute },
    timeZone,
  );
  if (today.getTime() > from.getTime()) {
    return today;
  }
  return fromCivilTime(
    {
      date: addDays(current.date, 1),
      hour: schedule.hour,
      minute: schedule.minute,
    },
    timeZone,
  );
}

/** `YYYY-MM-DD` -> `dd/mm/aaaa`, el formato que exigen las historias. */
export function formatCivilDate(civilDate: string): string {
  if (!isCalendarDate(civilDate)) {
    throw new Error(`Fecha civil inválida: ${String(civilDate)}`);
  }
  const [year, month, day] = civilDate.split('-');
  return `${day}/${month}/${year}`;
}

/** Fecha y hora legibles en la zona del gimnasio para un instante UTC. */
export function formatGymDateTime(
  instant: Date,
  timeZone: string = GYM_TIME_ZONE,
): GymDateTime {
  const civil = toCivilTime(instant, timeZone);
  return {
    date: formatCivilDate(civil.date),
    time: `${pad(civil.hour)}:${pad(civil.minute)}`,
  };
}
