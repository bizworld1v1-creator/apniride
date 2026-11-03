import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Lets the auth e2e test read the OTP from the response instead of an SMS.
    env: { OTP_DEV_ECHO: 'true' },
  },
});
