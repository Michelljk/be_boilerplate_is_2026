/**
 * Topes de negocio del dominio de progreso físico (H24, H25 y H26).
 *
 * Viven separados del DTO para que el servicio y el repositorio puedan
 * revalidar sin importar tipos de capa HTTP.
 */

/** Máximo de marcas de ejercicio por registro diario (contrato H24). */
export const MAX_MARKS_PER_RECORD = 30;

/** Cantidad de páginas por defecto en los listados de progreso. */
export const DEFAULT_PAGE_SIZE = 10;

/** Techo explícito de paginación (convención del proyecto: 50). */
export const MAX_PAGE_SIZE = 50;

/** Máximo de puntos entregados por una serie temporal H25/H26. */
export const MAX_SERIES_POINTS = 365;

/** Días máximos admitidos entre `from` y `to` (inclusive). */
export const MAX_RANGE_DAYS = 366;

/** Largo máximo de la búsqueda por nombre o número de miembro (H26). */
export const MAX_MEMBER_SEARCH_LENGTH = 100;

/** Cifras decimales admitidas en pesos y medidas. */
export const DECIMAL_PLACES = 2;

/** Milisegundos de un día civil, para aritmética de rangos. */
export const MILLISECONDS_PER_DAY = 86_400_000;

export const WEIGHT_KG_MIN = 20;
export const WEIGHT_KG_MAX = 300;
export const MEASURE_CM_MIN = 10;
export const MEASURE_CM_MAX = 250;
export const MARK_WEIGHT_KG_MIN = 0;
export const MARK_WEIGHT_KG_MAX = 500;
export const MARK_REPS_MIN = 1;
export const MARK_REPS_MAX = 100;
