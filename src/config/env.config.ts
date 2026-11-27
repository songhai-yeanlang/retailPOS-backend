import dotenv from 'dotenv';

dotenv.config();

type NodeEnv = 'development' | 'production' | 'test';

const getRequiredEnv = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const getOptionalEnv = (key: string, fallback: string): string => {
  const value = process.env[key]?.trim();
  return value && value.length > 0 ? value : fallback;
};

const parseNumberEnv = (key: string, fallback: number): number => {
  const raw = process.env[key]?.trim();
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${key} must be a positive number, received "${raw}"`);
  }
  return parsed;
};

const parseNodeEnv = (raw: string | undefined): NodeEnv => {
  if (raw === 'production' || raw === 'test' || raw === 'development') {
    return raw;
  }
  return 'development';
};

const parseCorsOrigins = (raw: string): string | string[] => {
  if (raw === '*') {
    return '*';
  }
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    return '*';
  }

  return origins.length === 1 ? origins[0] : origins;
};

const nodeEnv = parseNodeEnv(process.env.NODE_ENV);
const jwtSecret = getRequiredEnv('JWT_SECRET');

export const env = {
  nodeEnv,
  isDevelopment: nodeEnv === 'development',
  isProduction: nodeEnv === 'production',
  port: parseNumberEnv('PORT', 3009),

  cors: {
    origin: parseCorsOrigins(getOptionalEnv('CORS_ORIGIN', '*')),
  },

  db: {
    host: getRequiredEnv('DB_HOST'),
    port: parseNumberEnv('DB_PORT', 3306),
    user: getRequiredEnv('DB_USER'),
    password: process.env.DB_PASSWORD ?? '',
    name: getRequiredEnv('DB_NAME'),
    connectionLimit: parseNumberEnv('DB_CONNECTION_LIMIT', 10),
  },

  jwt: {
    secret: jwtSecret,
    expiresIn: getOptionalEnv('JWT_EXPIRES_IN', '1d'),
    refreshSecret: getOptionalEnv('JWT_REFRESH_SECRET', jwtSecret),
    refreshExpiresIn: getOptionalEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  mail: {
    host: getOptionalEnv('SMTP_HOST', 'smtp.gmail.com'),
    port: parseNumberEnv('SMTP_PORT', 465),
    user: getOptionalEnv('MAIL_USER', ''),
    pass: getOptionalEnv('MAIL_PASS', ''),
    from: getOptionalEnv('MAIL_FROM', getOptionalEnv('MAIL_USER', '')),
  },

  upload: {
    dir: getOptionalEnv('UPLOAD_DIR', 'uploads'),
    maxFileSizeMb: parseNumberEnv('MAX_FILE_SIZE_MB', 5),
  },
} as const;

export type EnvConfig = typeof env;

export default env;
