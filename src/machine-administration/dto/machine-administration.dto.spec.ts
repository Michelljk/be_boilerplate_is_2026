import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ListMachinesQueryDto,
  MaintenanceHistoryQueryDto,
} from './machine-administration.dto.js';

describe('Machine administration query DTOs (H27)', () => {
  it('preserves openOnly=false instead of coercing the string to true', async () => {
    const query = plainToInstance(MaintenanceHistoryQueryDto, {
      openOnly: 'false',
      page: '2',
      pageSize: '50',
    });

    expect(query.openOnly).toBe(false);
    expect(query.page).toBe(2);
    expect(query.pageSize).toBe(50);
    await expect(validate(query)).resolves.toHaveLength(0);
  });

  it.each(['0', 'yes', 'TRUE', '', '1'])(
    'rejects invalid openOnly value %s for HTTP 400 validation',
    async (openOnly) => {
      const query = plainToInstance(MaintenanceHistoryQueryDto, { openOnly });
      const errors = await validate(query);
      expect(errors.some((error) => error.property === 'openOnly')).toBe(true);
    },
  );

  it.each(['1e2', '1.5', 'abc', ''])(
    'rejects malformed history pagination value %s',
    async (page) => {
      const query = plainToInstance(MaintenanceHistoryQueryDto, { page });
      const errors = await validate(query);
      expect(errors.some((error) => error.property === 'page')).toBe(true);
    },
  );

  it('rejects malformed administrative list pagination instead of coercing it', async () => {
    const query = plainToInstance(ListMachinesQueryDto, { page: '1e2' });
    const errors = await validate(query);
    expect(errors.some((error) => error.property === 'page')).toBe(true);
  });
});
