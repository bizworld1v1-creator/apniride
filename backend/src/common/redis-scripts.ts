import type { Redis } from 'ioredis';

const COMPARE_AND_DELETE = `
if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end
return 0`;

/**
 * Deletes `key` only if it still holds `expected`. Returns true if this call deleted it.
 * Used as a tiny lock: e.g. an offer is consumed by exactly one of accept / decline / timeout.
 */
export async function compareAndDelete(redis: Redis, key: string, expected: string): Promise<boolean> {
  return (await redis.eval(COMPARE_AND_DELETE, 1, key, expected)) === 1;
}

/** Splits a redis:// URL into the options BullMQ wants (it manages its own connections). */
export function bullConnection(redisUrl: string) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}
