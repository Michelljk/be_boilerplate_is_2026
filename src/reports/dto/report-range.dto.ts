import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  Matches,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

function IsValidRange(
  precision: 'date' | 'month',
  options?: ValidationOptions,
) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isValidReportRange',
      target: object.constructor,
      propertyName,
      constraints: [precision],
      options,
      validator: {
        validate(to: unknown, args: ValidationArguments): boolean {
          const from = (args.object as Record<string, unknown>).from;
          if (typeof from !== 'string' || typeof to !== 'string') return false;
          const datePattern =
            precision === 'date' ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}$/;
          if (!datePattern.test(from) || !datePattern.test(to)) return false;
          const start = parseCivil(from, precision);
          const end = parseCivil(to, precision);
          if (!start || !end || end.timestamp < start.timestamp) return false;
          if (precision === 'month') return end.index - start.index <= 11;

          // Date ranges are measured in real calendar months, not by truncating
          // both dates to YYYY-MM. An exact one-year anniversary is valid, while
          // the day after it is not. Clamping February 29 to February 28 keeps
          // the comparison civil and avoids JavaScript Date rollover.
          const anniversaryMonth = start.month;
          const anniversaryYear = start.year + 1;
          const anniversaryDay = Math.min(
            start.day,
            daysInMonth(anniversaryYear, anniversaryMonth),
          );
          const anniversary = Date.UTC(
            anniversaryYear,
            anniversaryMonth - 1,
            anniversaryDay,
          );
          return end.timestamp <= anniversary;
        },
        defaultMessage(): string {
          return 'Rango inválido o mayor a 12 meses.';
        },
      },
    });
  };
}

function parseCivil(
  value: string,
  precision: 'date' | 'month',
): {
  index: number;
  year: number;
  month: number;
  day: number;
  timestamp: number;
} | null {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  if (month < 1 || month > 12) return null;
  if (precision === 'month') {
    return {
      index: year * 12 + month - 1,
      year,
      month,
      day: 1,
      timestamp: Date.UTC(year, month - 1, 1),
    };
  }
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return {
    index: year * 12 + month - 1,
    year,
    month,
    day,
    timestamp: date.getTime(),
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export class DateRangeDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;

  @IsValidRange('date')
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;
}

export class MonthRangeDto {
  @Matches(/^\d{4}-\d{2}$/)
  from!: string;

  @IsValidRange('month')
  @Matches(/^\d{4}-\d{2}$/)
  to!: string;
}

export class TrainerPerformanceQueryDto extends DateRangeDto {
  @Transform(({ value }) => value ?? 'rating')
  @IsOptional()
  @IsIn(['rating', 'sessions'])
  sortBy: 'rating' | 'sessions' = 'rating';

  @Transform(({ value }) => value ?? 'desc')
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
