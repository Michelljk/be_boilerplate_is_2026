
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  type ValidationArguments,
} from 'class-validator';
import { isCalendarDate } from '@Common/time';

/**
 * Fecha civil YYYY-MM-DD del gimnasio (America/El_Salvador).
 * También rechaza fechas inexistentes como 2026-02-30.
 */
@ValidatorConstraint({ name: 'calendarDate', async: false })
export class CalendarDateConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown): boolean {
    return isCalendarDate(value);
  }

  defaultMessage(args?: ValidationArguments): string {
    const property = args?.property ?? 'La fecha';
    return `${property} debe ser una fecha civil válida en formato YYYY-MM-DD.`;
  }
}
