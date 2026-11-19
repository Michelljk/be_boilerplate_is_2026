import { validate } from 'class-validator';
import { DateRangeDto, MonthRangeDto } from './dto/report-range.dto.js';

async function errorsFor<T extends object>(value: T): Promise<number> {
  return (await validate(value)).length;
}

describe('report range validation', () => {
  it('rejects reversed dates within the same month', async () => {
    const range = Object.assign(new DateRangeDto(), {
      from: '2026-11-20',
      to: '2026-11-01',
    });
    expect(await errorsFor(range)).toBeGreaterThan(0);
  });

  it('accepts an exact 12-month date anniversary inclusively', async () => {
    const range = Object.assign(new DateRangeDto(), {
      from: '2025-01-01',
      to: '2026-01-01',
    });

    expect(await errorsFor(range)).toBe(0);
  });

  it('measures date ranges by calendar anniversary rather than truncated months', async () => {
    const shorterThanYear = Object.assign(new DateRangeDto(), {
      from: '2025-01-31',
      to: '2026-01-30',
    });
    const anniversary = Object.assign(new DateRangeDto(), {
      from: '2025-01-31',
      to: '2026-01-31',
    });
    const longerThanYear = Object.assign(new DateRangeDto(), {
      from: '2025-01-31',
      to: '2026-02-01',
    });

    await expect(errorsFor(shorterThanYear)).resolves.toBe(0);
    await expect(errorsFor(anniversary)).resolves.toBe(0);
    await expect(errorsFor(longerThanYear)).resolves.toBeGreaterThan(0);
  });

  it('rejects invalid civil dates even when their YYYY-MM values look valid', async () => {
    const range = Object.assign(new DateRangeDto(), {
      from: '2025-02-30',
      to: '2025-03-01',
    });

    expect(await errorsFor(range)).toBeGreaterThan(0);
  });

  it('keeps month reports to twelve inclusive month rows', async () => {
    const valid = Object.assign(new MonthRangeDto(), {
      from: '2025-01',
      to: '2025-12',
    });
    const tooLong = Object.assign(new MonthRangeDto(), {
      from: '2025-01',
      to: '2026-01',
    });

    await expect(errorsFor(valid)).resolves.toBe(0);
    await expect(errorsFor(tooLong)).resolves.toBeGreaterThan(0);
  });
});
