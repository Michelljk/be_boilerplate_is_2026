import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import type {
  ClassReservationListOptions,
  ClassReservationSnapshot,
} from './class-reservation.repository.types.js';
@Injectable()
export class ClassReservationReader {
  constructor(private readonly prisma: PrismaService) {}
  async listMine(
    memberId: string,
    options: ClassReservationListOptions,
  ): Promise<ClassReservationSnapshot> {
    const where = {
      memberId,
      ...(options.status ? { status: options.status } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.classReservation.count({ where }),
      this.prisma.classReservation.findMany({
        where,
        orderBy: { session: { startsAt: 'desc' } },
        skip: options.skip,
        take: options.take,
        select: {
          id: true,
          status: true,
          session: {
            select: {
              startsAt: true,
              endsAt: true,
              classTemplate: {
                select: {
                  name: true,
                },
              },
              trainer: {
                select: { profile: { select: { fullName: true } } },
              },
              room: { select: { name: true } },
            },
          },
        },
      }),
    ]);
    return {
      total,
      rows: rows.map((r) => ({
        id: r.id,
        status: r.status,
        startsAt: r.session.startsAt,
        endsAt: r.session.endsAt,
        className: r.session.classTemplate.name,
        trainerName: r.session.trainer.profile?.fullName ?? '',
        roomName: r.session.room.name,
      })),
    };
  }
}
