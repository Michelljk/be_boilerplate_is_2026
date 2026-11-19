import { Prisma } from '../../generated/prisma/client.js';
import { DomainError } from '../errors/domain.error.js';
import type { PrismaService } from '../../prisma/services/prisma.service.js';
/** Reintenta solo abortos serializables. Nunca repite una transacción confirmada. */
export async function serializable<T>(
  prisma: PrismaService,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      });
    } catch (error) {
      if (error instanceof DomainError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2034') {
          if (attempt < 2) continue;
          throw new DomainError(
            'CONFLICT',
            'Conflicto concurrente; vuelve a intentar.',
          );
        }
        if (error.code === 'P2002')
          throw new DomainError(
            'CONFLICT',
            'El registro ya existe o entra en conflicto con otro.',
          );
        if (error.code === 'P2003')
          throw new DomainError(
            'INVALID',
            'La referencia indicada no es válida.',
          );
        if (error.code === 'P2025')
          throw new DomainError('NOT_FOUND', 'Recurso no encontrado.');
      }
      throw error;
    }
  }
  throw new DomainError(
    'CONFLICT',
    'No se pudo completar la operación concurrente.',
  );
}
