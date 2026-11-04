import { ApiError, onboardingErrorCodeSchema } from '@apniride/shared';
import type { TFunction } from 'i18next';

const KNOWN = new Set<string>([
  ...onboardingErrorCodeSchema.options,
  'invalid_phone',
  'invalid_code',
  'code_expired',
  'too_many_attempts',
  'resend_too_soon',
  'rate_limited',
  'name_too_short',
  'name_too_long',
  'offer_expired',
  'invalid_ride_state',
  'driver_not_approved',
  'vehicle_not_set',
  'outside_service_area',
  'on_a_ride',
]);

/** Turns an API / network error into a message in the user's language. */
export function errorMessage(t: TFunction, err: unknown): string {
  if (err instanceof ApiError) {
    if (err.isNetworkError) return t('errors.network');
    if (err.code && KNOWN.has(err.code)) {
      const seconds = err.retryAfterSeconds ?? 60;
      return t(`errors.${err.code}`, { seconds, minutes: Math.ceil(seconds / 60) });
    }
  }
  return t('errors.generic');
}
