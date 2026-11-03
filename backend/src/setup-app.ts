import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './config/env.js';
import { RedisIoAdapter } from './realtime/redis-io.adapter.js';

/** Shared by main.ts and the e2e tests, so tests run the app exactly as production does. */
export async function setupApp(app: INestApplication): Promise<void> {
  app.enableCors();
  app.enableShutdownHooks();
  const adapter = new RedisIoAdapter(app, app.get(ConfigService<Env, true>).get('REDIS_URL', { infer: true }));
  await adapter.connect();
  app.useWebSocketAdapter(adapter);
}
