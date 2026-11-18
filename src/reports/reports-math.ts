export interface OccupancyForLabel {
  occupancyPct: number;
  confirmedReservations: number;
  name: string;
}

export function sortOccupancy<T extends OccupancyForLabel>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      b.occupancyPct - a.occupancyPct ||
      b.confirmedReservations - a.confirmedReservations ||
      a.name.localeCompare(b.name),
  );
}

export function occupancyLabel(
  index: number,
  count: number,
): 'ALTA' | 'BAJA' | null {
  if (count >= 6) {
    if (index < 3) return 'ALTA';
    if (index >= count - 3) return 'BAJA';
    return null;
  }
  if (index < Math.floor(count / 2)) return 'ALTA';
  if (index >= Math.ceil(count / 2)) return 'BAJA';
  return null;
}
