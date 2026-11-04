import { ApiError } from '@apniride/shared';

/**
 * Admin panel text is English only for now (staff tool). Error codes from the API → words for the admin.
 * If the team wants Urdu, move these into i18n files like the apps.
 */
const MESSAGES: Record<string, string> = {
  invalid_phone: 'Enter a Pakistani mobile number, e.g. 0300 1234567.',
  invalid_code: 'Wrong code. Check the SMS and try again.',
  code_expired: 'The code has expired. Ask for a new one.',
  too_many_attempts: 'Too many wrong codes. Ask for a new one.',
  resend_too_soon: 'Please wait a minute before asking for another code.',
  rate_limited: 'Too many codes asked for. Try again later.',
  not_admin: 'This number is not an admin (or was disabled). Ask an existing admin to run: pnpm admins add <phone> "<name>".',
  invalid_driver_state: 'The driver changed state in the meantime. Reload the page.',
  driver_not_found: 'No such driver.',
  ride_not_found: 'No such ride.',
  fare_rate_not_found: 'No fare rate for this city and vehicle.',
  required: 'Please write a reason (at least 3 characters). The driver will see it.',
  too_long: 'Too long (max 300 characters).',
  invalid_number: 'Enter whole numbers only (no decimals, not negative).',
  too_large: 'That number is too large.',
  minimum_below_base: 'The minimum fare must be at least the base fare.',
  validation_failed: 'Some values are not valid.',
};

export function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.isNetworkError) return 'Cannot reach the ApniRide server. Is the backend running?';
    if (err.code && MESSAGES[err.code]) return MESSAGES[err.code]!;
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}

export const errorFor = (code: string | undefined) => (code ? (MESSAGES[code] ?? null) : null);
