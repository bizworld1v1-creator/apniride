import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Env } from '../config/env.js';

export const REDIS = Symbol('REDIS');

@Injectable()
class RedisCloser implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}
  onApplicationShutdown() {
    this.redis.disconnect();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const logger = new Logger('Redis');
        const redis = new Redis(config.get('REDIS_URL', { infer: true }), {
          // Fail fast instead of queueing commands forever while Redis is down.
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 3_000,
          retryStrategy: (times) => Math.min(times * 500, 5_000),
        });
        let lastLogged = 0;
        redis.on('error', (err) => {
          // Avoid log spam while reconnecting.
          if (Date.now() - lastLogged > 30_000) {
            const code = (err as NodeJS.ErrnoException).code;
            logger.error(`${err.message || err.name}${code ? ` (${code})` : ''}`);
            lastLogged = Date.now();
          }
        });
        return redis;
      },
    },
    RedisCloser,
  ],
  exports: [REDIS],
})
export class RedisModule {}
