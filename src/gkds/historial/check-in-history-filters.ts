
export interface HistoryQuery {
  from?: string;
  to?: string;
  memberNumber?: string;
  page?: string | number;
  pageSize?: string | number;
}

export interface HistoryFilters {
  from: Date;
  to: Date;
  memberNumber?: string;
  page: number;
  pageSize: number;
  skip: number;
}

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Formato de fecha inválido.');
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error('Fecha inválida.');
  }

  return date;
}

function positiveInteger(
  value: string | number | undefined,
  defaultValue: number,
): number {
  if (value === undefined) return defaultValue;

  const number = Number(value);

  if (!Number.isInteger(number) || number < 1) {
    throw new Error('La paginación debe utilizar enteros positivos.');
  }

  return number;
}

export function buildHistoryFilters(
  query: HistoryQuery,
  today = new Date(),
): HistoryFilters {
  const currentDay = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  ));

  const defaultFrom = new Date(currentDay);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);

  const from = query.from
    ? parseDate(query.from)
    : defaultFrom;

  const to = query.to
    ? parseDate(query.to)
    : currentDay;

  if (from > to) {
    throw new Error('La fecha inicial no puede superar la final.');
  }

  const days = (to.getTime() - from.getTime()) / 86400000;

  if (days > 90) {
    throw new Error('El rango no puede superar 90 días.');
  }

  const page = positiveInteger(query.page, 1);
  const pageSize = positiveInteger(query.pageSize, 20);

  if (pageSize > 20) {
    throw new Error('El tamaño de página máximo es 20.');
  }

  const memberNumber = query.memberNumber?.trim();

  return {
    from,
    to,
    ...(memberNumber ? { memberNumber } : {}),
    page,
    pageSize,
    skip: (page - 1) * pageSize,
  };
}
