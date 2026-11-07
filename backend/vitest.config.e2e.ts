import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Dev OTP echo (no SMS) and short dispatch timers so the booking tests finish quickly.
    env: { OTP_DEV_ECHO: 'true', OFFER_TIMEOUT_SECONDS: '5', SEARCH_TIMEOUT_SECONDS: '4', BID_TIMEOUT_SECONDS: '5',
      // Uploads go to a gitignored test folder.
      UPLOAD_DIR: 'uploads/e2e',
      QUEUE_PREFIX: 'apniride-test',
      // The admin panel's login in the tests (own username, so the dev admin's session isn't touched).
      ADMIN_USERNAME: 'e2e-admin',
      ADMIN_PASSWORD: 'e2e-admin-password',
      // Every test signs up from 127.0.0.1.
      OTP_MAX_PER_IP_PER_HOUR: '100000',
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
