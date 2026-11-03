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
    /** Only "console" exists for now (prints the code in the server log). */
    SMS_PROVIDER: z.enum(['console']).default('console'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (env.OTP_DEV_ECHO) {
      ctx.addIssue({ code: 'custom', path: ['OTP_DEV_ECHO'], message: 'must be false in production' });
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
