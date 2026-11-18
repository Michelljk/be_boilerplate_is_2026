import { validate } from 'class-validator';
import { UserRole, type User } from '@PrismaClient';
import { DomainError } from '@Common/errors';
import { CreateReviewDto } from '../dto/create-review.dto.js';
import {
  EligibleSessionsQueryDto,
  ReviewAveragesQueryDto,
} from '../dto/reviews-query.dto.js';
import { REVIEW_MESSAGES } from '../reviews.errors.js';
import { ReviewsService } from './reviews.service.js';

const member = { id: 'member-id', role: UserRole.MIEMBRO } as User;
const admin = { id: 'admin-id', role: UserRole.RECEPCION_ADMIN } as User;
const eligible = {
  sessionId: 'session-id',
  className: 'Yoga',
  trainerName: 'Ana',
  completedAt: new Date('2026-01-02T10:00:00Z'),
};

function setup() {
  const repository = {
    findEligibleSessions: vi.fn(),
    createReview: vi.fn(),
    findAverages: vi.fn(),
    trainerAverages: vi.fn(),
  };
  return { repository, service: new ReviewsService(repository as never) };
}

describe('ReviewsService', () => {
  it('valida rating entero 1..5 y comment de hasta 500 caracteres', async () => {
    for (const rating of [0, 6, 1.5]) {
      const dto = Object.assign(new CreateReviewDto(), {
        sessionId: '31c59e76-4e51-4414-982c-88c1f3e998ad',
        rating,
      });
      expect(
        (await validate(dto)).some((error) => error.property === 'rating'),
      ).toBe(true);
    }
    const valid = Object.assign(new CreateReviewDto(), {
      sessionId: '31c59e76-4e51-4414-982c-88c1f3e998ad',
      rating: 5,
      comment: 'x'.repeat(500),
    });
    expect(await validate(valid)).toHaveLength(0);
    valid.comment = 'x'.repeat(501);
    expect(
      (await validate(valid)).some((error) => error.property === 'comment'),
    ).toBe(true);
  });

  it('rechaza roles no autorizados con FORBIDDEN', async () => {
    const { service, repository } = setup();
    await expect(
      service.findEligibleSessions(admin, new EligibleSessionsQueryDto()),
    ).rejects.toMatchObject({ kind: 'FORBIDDEN' });
    await expect(
      service.findAverages(member, {
        groupBy: 'class',
      } as ReviewAveragesQueryDto),
    ).rejects.toMatchObject({ kind: 'FORBIDDEN' });
    expect(repository.findEligibleSessions).not.toHaveBeenCalled();
  });

  it('solicita sesiones elegibles de la fuente del repositorio y pagina', async () => {
    const { service, repository } = setup();
    repository.findEligibleSessions.mockResolvedValue({
      rows: [eligible],
      total: 1,
    });
    const result = await service.findEligibleSessions(member, {
      page: 2,
      pageSize: 3,
    } as EligibleSessionsQueryDto);
    expect(repository.findEligibleSessions).toHaveBeenCalledWith(
      member.id,
      3,
      3,
    );
    expect(result).toEqual({ rows: [eligible], total: 1 });
  });

  it('rechaza rating fuera del rango del dominio', async () => {
    const { service, repository } = setup();
    await expect(
      service.createReview(member, {
        sessionId: 's',
        rating: 6,
      } as CreateReviewDto),
    ).rejects.toMatchObject({
      kind: 'INVALID',
      message: REVIEW_MESSAGES.ratingOutOfRange,
    });
    expect(repository.createReview).not.toHaveBeenCalled();
  });

  it('traduce sesión inexistente o ajena a 404', async () => {
    const { service, repository } = setup();
    repository.createReview.mockResolvedValue({ kind: 'SESSION_NOT_VISIBLE' });
    await expect(
      service.createReview(member, {
        sessionId: 's',
        rating: 4,
      } as CreateReviewDto),
    ).rejects.toMatchObject({ kind: 'NOT_FOUND' });
  });

  it.each([
    ['SESSION_NOT_COMPLETED', REVIEW_MESSAGES.sessionNotCompleted],
    ['ATTENDANCE_MISSING', REVIEW_MESSAGES.attendanceRequired],
    ['DUPLICATE', REVIEW_MESSAGES.duplicateReview],
  ] as const)('traduce %s a 409', async (kind, message) => {
    const { service, repository } = setup();
    repository.createReview.mockResolvedValue({ kind });
    await expect(
      service.createReview(member, {
        sessionId: 's',
        rating: 4,
      } as CreateReviewDto),
    ).rejects.toEqual(new DomainError('CONFLICT', message));
  });

  it('devuelve promedio null y mantiene paginación H30', async () => {
    const { service, repository } = setup();
    repository.findAverages.mockResolvedValue({
      rows: [
        {
          entityId: 'class-id',
          name: 'Yoga',
          reviewCount: 0,
          averageRating: null,
        },
      ],
      total: 7,
    });
    const result = await service.findAverages(admin, {
      groupBy: 'class',
      page: 2,
      pageSize: 5,
    } as ReviewAveragesQueryDto);
    expect(repository.findAverages).toHaveBeenCalledWith({
      groupBy: 'class',
      sort: 'desc',
      skip: 5,
      take: 5,
    });
    expect(result).toEqual({
      rows: [
        {
          entityId: 'class-id',
          name: 'Yoga',
          reviewCount: 0,
          averageRating: null,
        },
      ],
      total: 7,
      page: 2,
      pageSize: 5,
    });
  });
});
