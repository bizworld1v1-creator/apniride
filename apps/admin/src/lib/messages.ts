import { ApiError } from '@apniride/shared';

/**
 * Admin panel text is English only for now (staff tool). Error codes from the API → words for the admin.
 * If the team wants Urdu, move these into i18n files like the apps.
 */
const MESSAGES: Record<string, string> = {
  invalid_login: 'Wrong username or password.',
  admin_login_off: 'The admin login is not set up. Put ADMIN_USERNAME and ADMIN_PASSWORD in backend/.env and restart the backend.',
  rate_limited: 'Too many wrong tries. Wait 15 minutes and try again.',
  not_admin: 'Please sign in again (the admin password may have changed).',
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
