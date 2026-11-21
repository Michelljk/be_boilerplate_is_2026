export * from './progress.module.js';
export * from './controllers/index.js';
export * from './services/index.js';
export * from './repositories/index.js';
export * from './dto/index.js';
export * from './limits.js';
export * from './progress-views.js';

/**
 * `progress-metrics` comparte dos nombres con `dto/progress-query`
 * (`PROGRESS_METRICS` y `ProgressMetric`); se exportan sólo los helpers para
 * que el barril del dominio no tenga símbolos ambiguos.
 */
export {
  BODY_METRICS,
  EXERCISE_METRIC,
  isBodyMetric,
  isProgressMetric,
  metricUnit,
  roundToTwoDecimals,
} from './progress-metrics.js';
