import { createLogger, format, transports } from 'winston';

const { combine, timestamp, printf, colorize, errors, splat } = format;

const devConsoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  splat(),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    const base = `${timestamp} [${level}] ${message}`;
    return stack ? `${base}\n${stack}${metaStr}` : `${base}${metaStr}`;
  })
);

const prodJsonFormat = combine(
  timestamp(),
  errors({ stack: true }),
  splat(),
  format.json()
);

const isDev = process.env.NODE_ENV !== 'production';

const logger = createLogger({
  level: isDev ? 'debug' : 'info',
  format: isDev ? devConsoleFormat : prodJsonFormat,
  transports: [
    new transports.Console({
      format: isDev ? devConsoleFormat : prodJsonFormat,
    }),
    // Optional file logs in JSON for prod:
    // new transports.File({ filename: 'logs/app.log', level: 'info' }),
    // new transports.File({ filename: 'logs/error.log', level: 'error' }),
  ],
});

export default logger;