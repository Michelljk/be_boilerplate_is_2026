import { Injectable } from '@nestjs/common';
import { DomainError } from '@Common/errors';
import { TrainingCatalogRepository } from '../repositories/training-catalog.repository.js';
@Injectable()
export class TrainingCatalogService {
  constructor(private readonly repository: TrainingCatalogRepository) {}
  async assignedMembers(trainerId: string) {
    const rows = await this.repository.assignedMembers(trainerId);
    return {
      data: rows.map(({ member }) => {
        if (!member.profile || !member.memberProfile)
          throw new DomainError(
            'CONFLICT',
            'El miembro asignado no tiene perfiles completos.',
          );
        return {
          id: member.id,
          memberNumber: member.memberProfile.memberNumber,
          fullName: member.profile.fullName,
        };
      }),
    };
  }
  exercises(page: number, pageSize: number) {
    return this.repository.exercises(page, pageSize);
  }
}
