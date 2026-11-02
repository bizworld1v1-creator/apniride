import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';
import type { Env } from '../config/env.js';

export const PG_POOL = Symbol('PG_POOL');

@Injectable()
class PoolCloser implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}
  async onApplicationShutdown() {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const logger = new Logger('Postgres');
        const pool = new pg.Pool({
          connectionString: config.get('DATABASE_URL', { infer: true }),
          max: 10,
          connectionTimeoutMillis: 3_000,
        });
        // Don't crash the process if an idle client errors (e.g. DB restart).
        pool.on('error', (err) => logger.error(`idle client error: ${err.message}`));
        return pool;
      },
    },
    PoolCloser,
  ],
  exports: [PG_POOL],
})
export class DatabaseModule {}
