export interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: number;
  REFRESH_TOKEN_EXPIRES_IN_DAYS: number;
  BCRYPT_SALT_ROUNDS: number;
}
function text(
  raw: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = raw[key];
  if (value === undefined || value === '') return fallback;
  if (typeof value !== 'string') throw new Error(`${key} debe ser una cadena.`);
  return value;
}
function integer(
  raw: Record<string, unknown>,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = raw[key];
  const parsed = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max)
    throw new Error(`${key} debe estar entre ${min} y ${max}.`);
  return parsed;
}
export function validateEnv(raw: Record<string, unknown>): EnvConfig {
  const databaseUrl = text(raw, 'DATABASE_URL', '');
  if (!/^postgres(ql)?:\/\//.test(databaseUrl))
    throw new Error('DATABASE_URL PostgreSQL es obligatoria.');
  const secret = text(raw, 'JWT_SECRET', '');
  if (secret.length < 32 || /cambiame|placeholder|change-me/i.test(secret))
    throw new Error(
      'JWT_SECRET debe tener al menos 32 caracteres aleatorios y no ser un placeholder.',
    );
  const ttl = text(raw, 'JWT_EXPIRES_IN', '15m');
  const match = /^(\d+)(s|m|h|d)$/.exec(ttl);
  if (!match)
    throw new Error('JWT_EXPIRES_IN usa un entero seguido de s, m, h o d.');
  const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  const seconds = Number(match[1]) * units[match[2]!]!;
  if (seconds < 60 || seconds > 86400)
    throw new Error('El access token debe durar de 60 segundos a 24 horas.');
  const nodeEnv = text(raw, 'NODE_ENV', 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv))
    throw new Error('NODE_ENV inválido.');
  return {
    NODE_ENV: nodeEnv,
    PORT: integer(raw, 'PORT', 3000, 1, 65535),
    DATABASE_URL: databaseUrl,
    JWT_SECRET: secret,
    JWT_EXPIRES_IN: seconds,
    REFRESH_TOKEN_EXPIRES_IN_DAYS: integer(
      raw,
      'REFRESH_TOKEN_EXPIRES_IN_DAYS',
      7,
      1,
      30,
    ),
    BCRYPT_SALT_ROUNDS: integer(raw, 'BCRYPT_SALT_ROUNDS', 12, 10, 14),
  };
}
