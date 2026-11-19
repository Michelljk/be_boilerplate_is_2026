import { Prisma } from '@PrismaClient';
import { DomainError } from '@Common/errors';
import { isCalendarDate } from '@Common/time';
import { DECIMAL_PLACES } from './limits.js';

/**
 * Las columnas `@db.Date` llegan a Prisma como medianoche UTC. La forma
 * correcta de leerlas es en UTC, nunca en la zona del gimnasio, porque
 * convertirlas a America/El_Salvador las correría un día hacia atrás.
 */
export function toCivilDate(value: Date): string {
  const text = value.toISOString().slice(0, 10);
  if (!isCalendarDate(text)) {
    throw new DomainError(
      'CONFLICT',
      'El registro de progreso contiene una fecha inválida.',
    );
  }
  return text;
}

/** Decimal de Prisma a número de contrato; `null` se conserva como `null`. */
export function decimalToNumber(value: Prisma.Decimal | null): number | null {
  if (value === null) {
    return null;
  }
  return value.toNumber();
}

/**
 * Número de contrato a texto decimal de dos cifras.
 *
 * Se entrega como cadena para que el controlador decimale de Prisma no herede
 * el ruido binario de un número JavaScript.
 */
export function numberToDecimalText(value: number): string {
  return value.toFixed(DECIMAL_PLACES);
}
