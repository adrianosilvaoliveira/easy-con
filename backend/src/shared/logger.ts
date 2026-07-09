import winston from 'winston';
import { env } from '../configs/env';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const isProduction = env.NODE_ENV === 'production';

const devFormat = printf(({ level, message, timestamp: ts, stack, requestId }) => {
  const reqId = requestId ? ` [req:${requestId}]` : '';
  return `${ts} [${level}]${reqId}: ${stack || message}`;
});

/** JSON em produção (parseável por Vercel/APMs); legível e colorido em dev. */
const consoleFormat = isProduction ? json() : combine(colorize(), devFormat);

const transports: winston.transport[] = [
  new winston.transports.Console({ format: consoleFormat }),
];

/** Vercel/serverless: filesystem é somente leitura — sem arquivo em logs/ */
if (!process.env.VERCEL) {
  transports.push(
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  );
}

export const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })
  ),
  transports,
});
