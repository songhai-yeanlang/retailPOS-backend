import env from '../config/env.config';

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

const formatTimestamp = (): string => new Date().toISOString();

const formatPayload = (payload: unknown): string => {
  if (payload === undefined) {
    return '';
  }

  if (payload instanceof Error) {
    return payload.stack ?? `${payload.name}: ${payload.message}`;
  }

  if (typeof payload === 'string') {
    return payload;
  }

  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
};

const writeLog = (level: LogLevel, message: string, meta?: unknown): void => {
  const prefix = `[${formatTimestamp()}] [${level}]`;
  const formattedMeta = formatPayload(meta);
  const output = formattedMeta ? `${prefix} ${message} | ${formattedMeta}` : `${prefix} ${message}`;

  if (level === 'ERROR') {
    console.error(output);
    return;
  }

  if (level === 'WARN') {
    console.warn(output);
    return;
  }

  console.log(output);
};

export const logger = {
  info(message: string, meta?: unknown): void {
    writeLog('INFO', message, meta);
  },

  warn(message: string, meta?: unknown): void {
    writeLog('WARN', message, meta);
  },

  error(message: string, error?: unknown): void {
    writeLog('ERROR', message, error);
  },

  debug(message: string, meta?: unknown): void {
    if (!env.isProduction) {
      writeLog('DEBUG', message, meta);
    }
  },
};

export default logger;
