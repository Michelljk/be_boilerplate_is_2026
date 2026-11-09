import { ApiProperty } from '@nestjs/swagger';
import type { TrainingRoutineAssignment } from '../services/routine-assignment.service.js';

export class TrainingRoutineAssignmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  memberId!: string;

  @ApiProperty({ format: 'uuid' })
  trainerId!: string;

  @ApiProperty({ example: 1, minimum: 1 })
  version!: number;

  @ApiProperty({ enum: ['VIGENTE'], example: 'VIGENTE' })
  status!: 'VIGENTE';

  @ApiProperty({ format: 'date-time' })
  assignedAt!: string;

  @ApiProperty({ format: 'date', example: '2026-11-10' })
  startsOn!: string;

  @ApiProperty({ format: 'date', example: '2026-12-10' })
  endsOn!: string;

  @ApiProperty({ example: 4, minimum: 1, maximum: 50 })
  exerciseCount!: number;

  static fromAssignment(
    value: TrainingRoutineAssignment,
  ): TrainingRoutineAssignmentResponseDto {
    const response = new TrainingRoutineAssignmentResponseDto();
    response.id = value.id;
    response.memberId = value.memberId;
    response.trainerId = value.trainerId;
    response.version = value.version;
    response.status = value.status;
    response.assignedAt = value.assignedAt.toISOString();
    response.startsOn = value.startsOn.toISOString().slice(0, 10);
    response.endsOn = value.endsOn.toISOString().slice(0, 10);
    response.exerciseCount = value.exerciseCount;
    return response;
  }
}
