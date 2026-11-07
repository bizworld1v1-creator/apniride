import { z } from 'zod';

/** "true"/"false" strings → boolean (z.coerce.boolean would turn "false" into true). */
const boolString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),

    /** Signs access tokens (JWT, HS256). Generate with: openssl rand -base64 48 */
    JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
    /** Peppers OTP code hashes and the Redis keys derived from phone numbers. */
    OTP_SECRET: z.string().min(32, 'must be at least 32 characters'),
    /** Return the OTP in the API response so you can test without SMS. Dev only. */
    OTP_DEV_ECHO: boolString,
    /** The one admin of the admin panel signs in with this username + password. */
    ADMIN_USERNAME: z.string().trim().min(3).max(64).default('admin'),
    /** Unset: the admin panel can't be opened. At least 12 characters in production. */
    ADMIN_PASSWORD: z.string().min(8, 'must be at least 8 characters').max(200).optional(),
    /** Only "console" exists for now (prints the code in the server log). */
    SMS_PROVIDER: z.enum(['console']).default('console'),
    /** OTP codes per client IP per hour. Generous because many users share carrier NAT IPs. */
    OTP_MAX_PER_IP_PER_HOUR: z.coerce.number().int().positive().default(30),

    /** Where driver document photos are stored (local disk). Relative paths are relative to backend/. */
    UPLOAD_DIR: z.string().min(1).default('uploads'),
    /** Seconds a driver has to answer a ride request (accept the price, counter-offer or decline). */
    OFFER_TIMEOUT_SECONDS: z.coerce.number().int().min(5).max(60).default(15),
    /** Seconds the passenger has to choose a driver's bid before it lapses. */
    BID_TIMEOUT_SECONDS: z.coerce.number().int().min(5).max(120).default(20),
    /** How many drivers see the same request at once (like inDrive). Topped up as they drop out. */
    MAX_PARALLEL_REQUESTS: z.coerce.number().int().min(1).max(20).default(5),
    /** Give up and tell the passenger "no driver" after this long. */
    SEARCH_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(600).default(120),
    /** Only offer rides to drivers within this distance of the pickup. */
    MATCH_RADIUS_KM: z.coerce.number().positive().max(30).default(5),
    /** BullMQ key prefix. Tests use their own so a running dev server doesn't pick up their jobs. */
    QUEUE_PREFIX: z.string().min(1).default('apniride'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (env.OTP_DEV_ECHO) {
      ctx.addIssue({ code: 'custom', path: ['OTP_DEV_ECHO'], message: 'must be false in production' });
    }
    if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 12) {
      ctx.addIssue({ code: 'custom', path: ['ADMIN_PASSWORD'], message: 'at least 12 characters in production' });
    }
    if (env.SMS_PROVIDER === 'console') {
      ctx.addIssue({
        code: 'custom',
        path: ['SMS_PROVIDER'],
        message: 'a real SMS provider is required in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Used by ConfigModule to fail fast on missing/invalid env vars. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}
