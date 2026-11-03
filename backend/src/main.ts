import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';
import { setupApp } from './setup-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await setupApp(app);
  const port = app.get(ConfigService<Env, true>).get('PORT', { infer: true });
  // 0.0.0.0 so phones on the same Wi-Fi can reach the dev server.
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`ApniRide API on http://localhost:${port} (GET /health, Socket.IO on the same port)`);
}
await bootstrap();
