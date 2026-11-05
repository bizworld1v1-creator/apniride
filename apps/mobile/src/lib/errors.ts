import { ApiError, onboardingErrorCodeSchema } from '@apniride/shared';
import type { TFunction } from 'i18next';

/** Error codes with their own message in `errors.*` (both modes). Anything else shows the generic message. */
const KNOWN = new Set<string>([
  ...onboardingErrorCodeSchema.options,
  // Sign-in
  'invalid_phone',
  'invalid_code',
  'code_expired',
  'too_many_attempts',
  'resend_too_soon',
  'rate_limited',
  'name_too_short',
  'name_too_long',
  // Mode switch
  'go_offline_first',
  'active_ride_exists',
  'wrong_app',
  // Passenger rides
  'outside_service_area',
  'trip_too_short',
  'trip_too_long',
  'quote_expired',
  'invalid_ride_state',
  // Driver mode
  'offer_expired',
  'driver_not_approved',
  'vehicle_not_set',
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
