import { healthResponseSchema } from '@apniride/shared';
import { HealthService } from './health.service.js';

const makeService = (opts: { pgOk: boolean; redisOk: boolean }) => {
  const pool = {
    query: vi.fn(() =>
      opts.pgOk
        ? Promise.resolve({ rows: [{ version: '3.5.2' }] })
        : Promise.reject(new Error('connection refused')),
    ),
  };
  const redis = {
    ping: vi.fn(() =>
      opts.redisOk ? Promise.resolve('PONG') : Promise.reject(new Error('connection refused')),
    ),
  };
  return new HealthService(pool as never, redis as never);
};

describe('HealthService', () => {
  it('reports ok when Postgres and Redis are up', async () => {
    const result = await makeService({ pgOk: true, redisOk: true }).check();
    expect(() => healthResponseSchema.parse(result)).not.toThrow();
    expect(result.status).toBe('ok');
    expect(result.services.postgres.postgis).toBe('3.5.2');
  });

  it('reports degraded when Redis is down', async () => {
    const result = await makeService({ pgOk: true, redisOk: false }).check();
    expect(result.status).toBe('degraded');
    expect(result.services.redis).toEqual({ status: 'down', latencyMs: null });
  });

  it('reports degraded when Postgres is down', async () => {
    const result = await makeService({ pgOk: false, redisOk: true }).check();
    expect(result.status).toBe('degraded');
    expect(result.services.postgres).toEqual({ status: 'down', postgis: null, latencyMs: null });
  });
});
