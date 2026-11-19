import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  CreateTrainingRoutineDto,
  CreateTrainingRoutineVersionDto,
} from './create-training-routine.dto.js';

const base = {
  name: 'Rutina de fuerza',
  goal: 'Mejorar fuerza general',
  startsOn: '2026-11-10',
  endsOn: '2026-12-10',
  exercises: [
    {
      exerciseId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      weekday: 1,
      sets: 3,
      reps: 10,
      position: 1,
    },
  ],
};

describe('CreateTrainingRoutineVersionDto (H26)', () => {
  it('exige expectedCurrentVersion sin cambiar el contrato H22', async () => {
    const h26Errors = await validate(
      plainToInstance(CreateTrainingRoutineVersionDto, base),
    );
    const h22Errors = await validate(
      plainToInstance(CreateTrainingRoutineDto, {
        ...base,
        memberId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      }),
    );

    expect(
      h26Errors.find((error) => error.property === 'expectedCurrentVersion'),
    ).toBeDefined();
    expect(
      h22Errors.find((error) => error.property === 'expectedCurrentVersion'),
    ).toBeUndefined();
  });
});
