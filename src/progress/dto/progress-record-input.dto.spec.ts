import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ProgressRecordInputDto } from './progress-record-input.dto.js';

const base = { recordDate: '2026-11-10', weightKg: 80 };

describe('ProgressRecordInputDto (H24)', () => {
  it('rechaza marks:null pero permite omitir marks', async () => {
    const omitted = await validate(
      plainToInstance(ProgressRecordInputDto, base),
    );
    const nulled = await validate(
      plainToInstance(ProgressRecordInputDto, { ...base, marks: null }),
    );

    expect(omitted.find((error) => error.property === 'marks')).toBeUndefined();
    expect(nulled.find((error) => error.property === 'marks')).toMatchObject({
      property: 'marks',
    });
  });
});
