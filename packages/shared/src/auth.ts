import { z } from 'zod';

// ---------------------------------------------------------------------------
// Phone numbers (Pakistan mobile only for now)
// ---------------------------------------------------------------------------

/** Pakistani mobile in E.164: +92 followed by 3 and 9 more digits, e.g. +923001234567. */
export const E164_PK_MOBILE = /^\+923\d{9}$/;

/**
 * Normalises the ways people type a Pakistani mobile number into E.164.
 * Accepts "0300 1234567", "300-1234567", "+92 300 1234567", "923001234567", "00923001234567".
 * Returns null if it isn't a valid Pakistani mobile number.
 */
export function normalizePkMobile(input: string): string | null {
  // Keep a leading + so "+92…" and "92…" both work, drop spaces, dashes, brackets.
  let digits = input.trim().replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  if (!/^\d+$/.test(digits)) return null;

  let national: string;
  if (digits.startsWith('92')) national = digits.slice(2);
  else if (digits.startsWith('0')) national = digits.slice(1);
  else national = digits;

  const e164 = `+92${national}`;
  return E164_PK_MOBILE.test(e164) ? e164 : null;
}

/**
 * Masks a phone number for display and logs: "+923001234567" → "+92 3•• ••• 4567".
 * Phone numbers must never be shown in full to the other party or written to logs.
 */
export function maskPhone(e164: string): string {
  const last4 = e164.slice(-4);
  return e164.startsWith('+92') ? `+92 3•• ••• ${last4}` : `•••• ${last4}`;
}

/** Accepts anything a user might type and outputs E.164 (+923XXXXXXXXX). */
export const pkMobileSchema = z
  .string()
  .transform((value, ctx) => {
    const normalized = normalizePkMobile(value);
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'invalid_phone' });
      return z.NEVER;
    }
    return normalized;
  });

// ---------------------------------------------------------------------------
// OTP auth
// ---------------------------------------------------------------------------

export const OTP_LENGTH = 6;

/**
 * The role of a session. One phone number can be a passenger and a driver.
 * "admin" is the admin panel, signed in with username + password (POST /auth/admin/login), never with OTP.
 */
export const userRoleSchema = z.enum(['passenger', 'driver', 'admin']);
export type UserRole = z.infer<typeof userRoleSchema>;

/** The two modes of the one mobile app. One account can use both (like inDrive's "Driver mode"). */
export const appModeSchema = z.enum(['passenger', 'driver']);
export type AppMode = z.infer<typeof appModeSchema>;

export const otpCodeSchema = z.string().regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), 'invalid_code');

export const requestOtpBodySchema = z.object({
  phone: pkMobileSchema,
  role: appModeSchema,
});
export type RequestOtpBody = z.input<typeof requestOtpBodySchema>;

export const requestOtpResponseSchema = z.object({
  /** Seconds until this code expires. */
  expiresInSeconds: z.number().int(),
  /** Seconds until the user may ask for another code. */
  resendInSeconds: z.number().int(),
  /** Only present in local development (OTP_DEV_ECHO=true). Never in production. */
  devCode: z.string().optional(),
});
export type RequestOtpResponse = z.infer<typeof requestOtpResponseSchema>;

export const verifyOtpBodySchema = z.object({
  phone: pkMobileSchema,
  role: appModeSchema,
  code: otpCodeSchema,
});
export type VerifyOtpBody = z.input<typeof verifyOtpBodySchema>;

/** The admin panel's sign-in: ADMIN_USERNAME + ADMIN_PASSWORD from backend/.env. */
export const adminLoginBodySchema = z.object({
  username: z.string().trim().min(1, 'required').max(64),
  password: z.string().min(1, 'required').max(200),
});
export type AdminLoginBody = z.input<typeof adminLoginBodySchema>;

export const userSchema = z.object({
  id: z.string().uuid(),
  role: userRoleSchema,
  name: z.string().nullable(),
  /** Masked – the full number is never sent back to apps. Empty for the admin (no phone). */
  phoneMasked: z.string(),
  /** When the profile photo last changed (null / missing: no photo). Use it to bust the image cache. */
  photoUpdatedAt: z.string().nullable().optional(),
});
export type User = z.infer<typeof userSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** Seconds until the access token expires. */
  expiresInSeconds: z.number().int(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const authSessionSchema = authTokensSchema.extend({
  user: userSchema,
  /** True the first time this phone number signs in. */
  isNewUser: z.boolean(),
});
export type AuthSession = z.infer<typeof authSessionSchema>;

export const refreshBodySchema = z.object({ refreshToken: z.string().min(20) });
export type RefreshBody = z.infer<typeof refreshBodySchema>;

/**
 * Switches the signed-in phone to the other mode without a new OTP: the server ends this session and starts one
 * for the new mode. Refused while the user has an active ride or (as a driver) is online.
 */
export const switchRoleBodySchema = refreshBodySchema.extend({ role: appModeSchema });
export type SwitchRoleBody = z.infer<typeof switchRoleBodySchema>;

export const updateProfileBodySchema = z.object({
  name: z.string().trim().min(2, 'name_too_short').max(60, 'name_too_long'),
});
export type UpdateProfileBody = z.input<typeof updateProfileBodySchema>;

/** Machine-readable error codes the apps translate into English/Urdu messages. */
export const authErrorCodeSchema = z.enum([
  'invalid_phone',
  'invalid_code',
  'code_expired',
  'too_many_attempts',
  'resend_too_soon',
  'rate_limited',
  'invalid_refresh_token',
  'unauthorized',
  'validation_failed',
  /** The route belongs to the other mode (e.g. a driver route with a passenger session). */
  'wrong_app',
  /** switch-role to the mode the session already has. */
  'same_role',
  /** switch-role from driver mode while online. */
  'go_offline_first',
  /** switch-role (or booking) while a ride is still going on. */
  'active_ride_exists',
  /** Admin panel: wrong username or password. */
  'invalid_login',
  /** Admin panel: ADMIN_PASSWORD is not set on the server. */
  'admin_login_off',
]);
export type AuthErrorCode = z.infer<typeof authErrorCodeSchema>;

/** Shape of every error response body from the API. */
export const apiErrorBodySchema = z.object({
  statusCode: z.number(),
  code: z.string(),
  message: z.string(),
  retryAfterSeconds: z.number().optional(),
});
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
