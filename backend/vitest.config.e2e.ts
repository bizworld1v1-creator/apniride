import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Dev OTP echo (no SMS), auto-approved drivers, and short dispatch timers so the booking tests finish quickly.
    env: { OTP_DEV_ECHO: 'true', DRIVER_AUTO_APPROVE: 'true', OFFER_TIMEOUT_SECONDS: '5', SEARCH_TIMEOUT_SECONDS: '4',
      QUEUE_PREFIX: 'apniride-test',
      // Every test signs up from 127.0.0.1.
      OTP_MAX_PER_IP_PER_HOUR: '100000',
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
