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
          if (!start || !end || end.index < start.index) return false;
          return end.index - start.index < 12;
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
): { index: number } | null {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  if (month < 1 || month > 12) return null;
  if (precision === 'month') return { index: year * 12 + month - 1 };
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return { index: year * 12 + month - 1 };
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
