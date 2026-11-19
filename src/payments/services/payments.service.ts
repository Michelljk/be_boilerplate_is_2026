
import { Injectable } from '@nestjs/common';
import { PaymentsRepository } from '../repositories/index.js';
import type { PaymentPendingQueryDto } from '../dto/payment-pending.dto.js';

/**
 * Servicio de pagos.
 * H20: consulta de pagos pendientes.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly repository: PaymentsRepository,
  ) {}

  /**
   * H20: obtiene los pagos pendientes
   * con filtros y paginación.
   */
  pending(query: PaymentPendingQueryDto) {
    return this.repository.pending(query);
  }
}
