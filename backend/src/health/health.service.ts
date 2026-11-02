import { Inject, Injectable } from '@nestjs/common';
import type { HealthResponse } from '@apniride/shared';
import type { Redis } from 'ioredis';
import type pg from 'pg';
import { PG_POOL } from '../database/database.module.js';
import { REDIS } from '../redis/redis.module.js';

const CHECK_TIMEOUT_MS = 2_000;

function withTimeout<T>(p: Promise<T>, ms = CHECK_TIMEOUT_MS): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async check(): Promise<HealthResponse> {
    const [postgres, redis] = await Promise.all([this.checkPostgres(), this.checkRedis()]);
    const allUp = postgres.status === 'up' && redis.status === 'up';
    return {
      status: allUp ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      services: { postgres, redis },
    };
  }

  private async checkPostgres(): Promise<HealthResponse['services']['postgres']> {
    const start = Date.now();
    try {
      const { rows } = await withTimeout(
        this.pool.query<{ version: string }>('SELECT PostGIS_Lib_Version() AS version'),
      );
      return { status: 'up', postgis: rows[0]?.version ?? null, latencyMs: Date.now() - start };
    } catch {
      return { status: 'down', postgis: null, latencyMs: null };
    }
  }

  private async checkRedis(): Promise<HealthResponse['services']['redis']> {
    const start = Date.now();
    try {
      await withTimeout(this.redis.ping());
      return { status: 'up', latencyMs: Date.now() - start };
    } catch {
      return { status: 'down', latencyMs: null };
    }
  }
}
