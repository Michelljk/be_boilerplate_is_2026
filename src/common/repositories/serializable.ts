import { Prisma } from '../../generated/prisma/client.js';
import { DomainError } from '../errors/domain.error.js';
import type { PrismaService } from '../../prisma/services/prisma.service.js';

/** Los adapters de Prisma pueden envolver SQLSTATE en meta.driverAdapterError.cause. */
function errorTokens(error: unknown, depth = 0): string[] {
  if (depth > 7 || error === null || error === undefined) return [];
  if (typeof error === 'string') return [error];
  if (typeof error !== 'object') return [];
  const object = error as Record<string, unknown>;
  const keys = [
    'code',
    'originalCode',
    'sqlState',
    'sqlstate',
    'kind',
    'message',
    'meta',
    'cause',
    'driverAdapterError',
    'originalError',
  ];
  return keys.flatMap((key) => errorTokens(object[key], depth + 1));
}

/** Reintenta únicamente transacciones abortadas, nunca una operación ya confirmada. */
export async function serializable<T>(
  prisma: PrismaService,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const attempts = 5;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 15000,
        timeout: 20000,
      });
    } catch (error) {
      if (error instanceof DomainError) throw error;
      const tokens = errorTokens(error);
      const has = (value: string) =>
        tokens.some(
          (token) =>
            token === value || new RegExp(`\\b${value}\\b`).test(token),
        );
      const retryable =
        has('P2034') ||
        has('40001') ||
        has('40P01') ||
        (has('P2039') &&
          tokens.some((token) =>
            /write conflict|serialization|TransactionWriteConflict/i.test(
              token,
            ),
          ));
      if (retryable) {
        if (attempt + 1 < attempts) {
          await new Promise((resolve) =>
            setTimeout(resolve, 10 * 2 ** attempt),
          );
          continue;
        }
        throw new DomainError(
          'CONFLICT',
          'Conflicto concurrente; vuelve a intentar.',
        );
      }
      if (has('23P01'))
        throw new DomainError('CONFLICT', 'Existe un conflicto de horario');
      if (has('P2002') || has('23505')) {
        throw new DomainError(
          'CONFLICT',
          'El registro ya existe o entra en conflicto con otro.',
        );
      }
      if (has('P2003') || has('23503'))
        throw new DomainError(
          'INVALID',
          'La referencia indicada no es válida.',
        );
      if (has('23514') || has('23502'))
        throw new DomainError(
          'INVALID',
          'Los datos no cumplen las restricciones del recurso.',
        );
      if (has('P2025'))
        throw new DomainError('NOT_FOUND', 'Recurso no encontrado');
      throw error;
    }
  }
  throw new DomainError(
    'CONFLICT',
    'No se pudo completar la operación concurrente.',
  );
}
