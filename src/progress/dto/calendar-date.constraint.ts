import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  type ValidationArguments,
} from 'class-validator';
import { isCalendarDate } from '@Common/time';

/**
 * Fecha civil `YYYY-MM-DD` del día del gimnasio (America/El_Salvador).
 *
 * `isCalendarDate` también rechaza días inexistentes como 2026-02-30, cosa que
 * un `@Matches` con expresión regular no puede hacer.
 */
@ValidatorConstraint({ name: 'calendarDate', async: false })
export class CalendarDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isCalendarDate(value);
  }

  defaultMessage(args?: ValidationArguments): string {
    const property = args?.property ?? 'La fecha';
    return `${property} debe ser una fecha civil válida en formato YYYY-MM-DD.`;
  }
}
