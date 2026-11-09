import { Injectable } from '@nestjs/common';
/** Fechas del gimnasio; los instantes se persisten en UTC. */
@Injectable()
export class GymClock {
  now(): Date {
    return new Date();
  }
  today(): string {
    return this.dateOf(this.now());
  }
  dateOf(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/El_Salvador',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const part = (key: string) => parts.find((p) => p.type === key)!.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
  dateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }
}
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function addDays(value: string, days: number): string {
  const d = new Date(`${value}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
