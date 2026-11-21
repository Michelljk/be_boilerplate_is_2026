import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdatePlanDto } from './membership.dto.js';

describe('UpdatePlanDto (H3)', () => {
  it('recorta el nombre antes de aplicar Length', async () => {
    const dto = plainToInstance(UpdatePlanDto, { name: '  Plan  ' });
    const errors = await validate(dto);
    expect(dto.name).toBe('Plan');
    expect(errors).toHaveLength(0);
  });

  it('rechaza null en campos no anulables del PATCH', async () => {
    const dto = plainToInstance(UpdatePlanDto, {
      name: null,
      type: null,
      priceUsd: null,
      benefits: null,
      status: null,
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'name',
        'type',
        'priceUsd',
        'benefits',
        'status',
      ]),
    );
  });
});
