import { Injectable } from '@nestjs/common';
import { UserRole, type User } from '@PrismaClient';
import { DomainError } from '@Common/errors';
import { REVIEW_MESSAGES } from '../reviews.errors.js';
import {
  ReviewsRepository,
  type AverageCriteria,
  type AverageRow,
  type EligibleSessionRow,
  type ReviewGate,
  type ReviewRecord,
  type TrainerAverageRow,
} from '../repositories/index.js';
import type { CreateReviewDto } from '../dto/create-review.dto.js';
import type {
  EligibleSessionsQueryDto,
  ReviewAveragesQueryDto,
} from '../dto/reviews-query.dto.js';

export interface EligibleSessionsPage {
  rows: EligibleSessionRow[];
  total: number;
}

export interface AveragesPage {
  rows: AverageRow[];
  total: number;
  page: number;
  pageSize: number;
}

const MAX_ELIGIBLE_PAGE_SIZE = 20;
const MAX_AVERAGES_PAGE_SIZE = 50;

/**
 * Reglas de H29 (calificar) y H30 (promedios).
 *
 * El servicio decide el código de error; el repositorio solo reporta qué
 * encontró en la base de datos.
 */
@Injectable()
export class ReviewsService {
  constructor(private readonly reviewsRepository: ReviewsRepository) {}

  /** Sesiones COMPLETADA con ASISTIO que el miembro aún no califica. */
  async findEligibleSessions(
    user: User,
    query: EligibleSessionsQueryDto,
  ): Promise<EligibleSessionsPage> {
    this.assertMember(user);
    const page = query.page ?? 1;
    const pageSize = this.clamp(query.pageSize ?? 10, MAX_ELIGIBLE_PAGE_SIZE);
    const snapshot = await this.reviewsRepository.findEligibleSessions(
      user.id,
      (page - 1) * pageSize,
      pageSize,
    );
    return { rows: snapshot.rows, total: snapshot.total };
  }

  /**
   * Registra la calificación. La unicidad (member, session) la sostiene la
   * base de datos; aquí solo se traduce el resultado del repositorio.
   */
  async createReview(user: User, dto: CreateReviewDto): Promise<ReviewRecord> {
    this.assertMember(user);
    this.assertRating(dto.rating);
    const result = await this.reviewsRepository.createReview({
      memberId: user.id,
      sessionId: dto.sessionId,
      rating: dto.rating,
      comment: dto.comment?.length ? dto.comment : null,
    });
    if (result.kind === 'CREATED') return result.review;
    throw this.ineligibilityError(result.kind);
  }

  /** Promedios por clase o por entrenador para RECEPCION_ADMIN (H30). */
  async findAverages(
    user: User,
    query: ReviewAveragesQueryDto,
  ): Promise<AveragesPage> {
    this.assertAdmin(user);
    const page = query.page ?? 1;
    const pageSize = this.clamp(query.pageSize ?? 20, MAX_AVERAGES_PAGE_SIZE);
    const criteria: AverageCriteria = {
      groupBy: query.groupBy,
      sort: query.sort ?? 'desc',
      skip: (page - 1) * pageSize,
      take: pageSize,
    };
    const snapshot = await this.reviewsRepository.findAverages(criteria);
    return { rows: snapshot.rows, total: snapshot.total, page, pageSize };
  }

  /** Expuesto para H39; reutiliza la misma agregación de H30. */
  trainerAverages(): Promise<TrainerAverageRow[]> {
    return this.reviewsRepository.trainerAverages();
  }

  private assertMember(user: User): void {
    if (user.role !== UserRole.MIEMBRO) {
      throw new DomainError('FORBIDDEN', REVIEW_MESSAGES.memberOnly);
    }
  }

  private assertAdmin(user: User): void {
    if (user.role !== UserRole.RECEPCION_ADMIN) {
      throw new DomainError('FORBIDDEN', REVIEW_MESSAGES.adminOnly);
    }
  }

  /** Cinturón de seguridad: el DTO ya declara 1..5, el dominio no depende de ello. */
  private assertRating(rating: number): void {
    const isValid = Number.isInteger(rating) && rating >= 1 && rating <= 5;
    if (isValid) return;
    throw new DomainError('INVALID', REVIEW_MESSAGES.ratingOutOfRange);
  }

  /**
   * `SESSION_NOT_VISIBLE` cubre dos hechos indistinguibles a propósito: sesión
   * inexistente y sesión de otro miembro. Revelar cuál existe filtraría
   * información de otros usuarios, así que ambos devuelven 404.
   */
  private ineligibilityError(kind: Exclude<ReviewGate, 'OPEN'>): DomainError {
    if (kind === 'SESSION_NOT_VISIBLE') {
      return new DomainError('NOT_FOUND', REVIEW_MESSAGES.sessionNotOwned);
    }
    if (kind === 'SESSION_NOT_COMPLETED') {
      return new DomainError('CONFLICT', REVIEW_MESSAGES.sessionNotCompleted);
    }
    if (kind === 'ATTENDANCE_MISSING') {
      return new DomainError('CONFLICT', REVIEW_MESSAGES.attendanceRequired);
    }
    return new DomainError('CONFLICT', REVIEW_MESSAGES.duplicateReview);
  }

  private clamp(pageSize: number, maximum: number): number {
    if (!Number.isInteger(pageSize) || pageSize < 1) return 1;
    return Math.min(pageSize, maximum);
  }
}
