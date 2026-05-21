import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

/** Vercel Postgres: POSTGRES_*, PRISMA_DATABASE_URL ou DATABASE_URL */
if (!process.env.DATABASE_URL && process.env.PRISMA_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.PRISMA_DATABASE_URL;
}
if (!process.env.DATABASE_URL && process.env.POSTGRES_PRISMA_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
}
if (!process.env.DIRECT_URL && process.env.POSTGRES_URL_NON_POOLING) {
  process.env.DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING;
}
if (!process.env.DIRECT_URL && process.env.POSTGRES_URL) {
  process.env.DIRECT_URL = process.env.POSTGRES_URL;
}
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

function vercelOrigin(): string | undefined {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return undefined;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3333),
  API_URL: z.string().url().optional(),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  HOSPITAL_NAME: z.string().default('Hospital Oftalmológico'),
  HOSPITAL_CNPJ: z.string().default(''),
  HOSPITAL_ADDRESS: z.string().default(''),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  FRONTEND_URL: z.string().url().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  /** Protege o cron da Vercel (`Authorization: Bearer <CRON_SECRET>`) */
  CRON_SECRET: z.string().min(16).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const data = parsed.data;
const defaultOrigin = vercelOrigin() ?? 'http://localhost:3333';

export const env = {
  ...data,
  API_URL: data.API_URL ?? defaultOrigin,
  /** Mesma origem no Vercel (frontend + API no mesmo domínio) ou FRONTEND_URL explícita */
  corsOrigin: data.FRONTEND_URL ?? vercelOrigin() ?? data.API_URL ?? defaultOrigin,
};
