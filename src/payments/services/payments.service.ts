import { Injectable } from '@nestjs/common';
import { PaymentsRepository } from '../repositories/index.js';
import type {
  PaymentHistoryQueryDto,
  PaymentPendingQueryDto,
} from '../dto/index.js';
@Injectable()
export class PaymentsService {
  constructor(private readonly repository: PaymentsRepository) {}
  myPending(memberId: string) {
    return this.repository.myPending(memberId);
  }
  memberPending(memberId: string, status: string) {
    return this.repository.memberPending(memberId, status);
  }
  payCard(id: string, memberId: string, body: unknown) {
    return this.repository.payCard(id, memberId, body);
  }
  collect(id: string, actorId: string, body: unknown) {
    return this.repository.collect(id, actorId, body);
  }
  history(memberId: string, query: PaymentHistoryQueryDto) {
    return this.repository.history(memberId, query);
  }
  pending(query: PaymentPendingQueryDto) {
    return this.repository.pending(query);
  }
  voidSearch(receiptNumber: string) {
    return this.repository.voidSearch(receiptNumber);
  }
  void(id: string, actorId: string, reason: string) {
    return this.repository.void(id, actorId, reason);
  }
  receiptPdf(receiptId: string, userId: string, role: string) {
    return this.repository.receiptPdf(receiptId, userId, role);
  }
}
