
import { Injectable } from '@nestjs/common';

import { PaymentsRepository } from '../repositories/index.js';

import type {
  PaymentHistoryQueryDto,
  PaymentHistoryResponseDto,
} from '../dto/payment-history.dto.js';

/**
 * H18: servicio de historial de pagos del miembro.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly repository: PaymentsRepository,
  ) {}

  /**
   * Consulta exclusivamente los pagos del miembro autenticado.
   */
  history(
    memberId: string,
    query: PaymentHistoryQueryDto,
  ): Promise<PaymentHistoryResponseDto> {
    return this.repository.history(memberId, query);
  }
}
