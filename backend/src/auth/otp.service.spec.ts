import { AppException } from '../common/app-exception.js';
import { OTP_LIMITS, OtpService } from './otp.service.js';
import type { SmsSender } from './sms.sender.js';

/** Just enough of ioredis for OtpService, kept in memory. Expiry is simulated with `expireNow`. */
class FakeRedis {
  strings = new Map<string, string>();
  hashes = new Map<string, Record<string, string>>();
  ttls = new Map<string, number>();

  async set(key: string, value: string, _ex: 'EX', seconds: number, nx?: 'NX') {
    if (nx && this.strings.has(key)) return null;
    this.strings.set(key, value);
    this.ttls.set(key, seconds);
    return 'OK';
  }
  async incr(key: string) {
    const n = Number(this.strings.get(key) ?? 0) + 1;
    this.strings.set(key, String(n));
    return n;
  }
  async expire(key: string, seconds: number) {
    this.ttls.set(key, seconds);
    return 1;
  }
  async ttl(key: string) {
    return this.ttls.get(key) ?? -2;
  }
  async hset(key: string, obj: Record<string, string>) {
    this.hashes.set(key, { ...obj });
    return Object.keys(obj).length;
  }
  async hgetall(key: string) {
    return { ...this.hashes.get(key) };
  }
  async hincrby(key: string, field: string, by: number) {
    const h = this.hashes.get(key) ?? {};
    h[field] = String(Number(h[field] ?? 0) + by);
    this.hashes.set(key, h);
    return Number(h[field]);
  }
  async del(key: string) {
    const existed = this.strings.delete(key) || this.hashes.delete(key);
    this.ttls.delete(key);
    return existed ? 1 : 0;
  }
  /** Simulates a key's TTL running out. */
  expireNow(prefix: string) {
    for (const k of [...this.strings.keys(), ...this.hashes.keys()]) {
      if (k.startsWith(prefix)) void this.del(k);
    }
  }
}

const PHONE = '+923001234567';
const IP = '203.0.113.7';
const MAX_PER_IP = 30;

function setup(devEcho = true) {
  const redis = new FakeRedis();
  const sent: { to: string; message: string }[] = [];
  const sms: SmsSender = {
    send: async (to, message) => {
      sent.push({ to, message });
    },
  };
  const config = {
    get: (k: string) => ({ OTP_SECRET: 'x'.repeat(40), OTP_DEV_ECHO: devEcho, OTP_MAX_PER_IP_PER_HOUR: MAX_PER_IP })[k],
  };
  const service = new OtpService(redis as never, sms, config as never);
  const lastCode = () => sent.at(-1)!.message.match(/\d{6}/)![0];
  return { redis, sent, service, lastCode };
}

async function expectCode(p: Promise<unknown>, code: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppException);
  expect((err as AppException).code).toBe(code);
  return err as AppException;
}

describe('OtpService', () => {
  it('sends a 6-digit code and verifies it once', async () => {
    const { service, sent, lastCode } = setup();
    const res = await service.request(PHONE, 'passenger', IP);
    expect(res).toMatchObject({ expiresInSeconds: OTP_LIMITS.ttlSeconds, resendInSeconds: 60 });
    expect(sent).toHaveLength(1);
    expect(res.devCode).toBe(lastCode());

    await expect(service.verify(PHONE, 'passenger', lastCode())).resolves.toBeUndefined();
    // Single use.
    await expectCode(service.verify(PHONE, 'passenger', lastCode()), 'code_expired');
  });

  it('does not echo the code unless OTP_DEV_ECHO is on', async () => {
    const { service } = setup(false);
    const res = await service.request(PHONE, 'passenger', IP);
    expect(res.devCode).toBeUndefined();
  });

  it('never stores the phone number or the code in plain text in Redis', async () => {
    const { service, redis, lastCode } = setup();
    await service.request(PHONE, 'passenger', IP);
    const dump = JSON.stringify([...redis.strings, ...redis.hashes]);
    expect(dump).not.toContain('3001234567');
    expect(dump).not.toContain(lastCode());
    expect(dump).not.toContain(IP);
  });

  it('rejects a wrong code, and a code for the other app', async () => {
    const { service, lastCode } = setup();
    await service.request(PHONE, 'passenger', IP);
    const wrong = lastCode() === '000000' ? '111111' : '000000';
    await expectCode(service.verify(PHONE, 'passenger', wrong), 'invalid_code');
    await expectCode(service.verify(PHONE, 'driver', lastCode()), 'invalid_code');
    // Still usable after failed attempts (below the limit).
    await expect(service.verify(PHONE, 'passenger', lastCode())).resolves.toBeUndefined();
  });

  it('burns the code after too many wrong attempts', async () => {
    const { service, lastCode } = setup();
    await service.request(PHONE, 'passenger', IP);
    const wrong = lastCode() === '000000' ? '111111' : '000000';
    for (let i = 0; i < OTP_LIMITS.maxAttempts; i++) {
      await expectCode(service.verify(PHONE, 'passenger', wrong), 'invalid_code');
    }
    await expectCode(service.verify(PHONE, 'passenger', lastCode()), 'too_many_attempts');
    await expectCode(service.verify(PHONE, 'passenger', lastCode()), 'code_expired');
  });

  it('reports an expired code', async () => {
    const { service, redis, lastCode } = setup();
    await service.request(PHONE, 'passenger', IP);
    redis.expireNow('otp:code:');
    await expectCode(service.verify(PHONE, 'passenger', lastCode()), 'code_expired');
  });

  it('enforces the resend cooldown with a retry-after', async () => {
    const { service, sent } = setup();
    await service.request(PHONE, 'passenger', IP);
    const err = await expectCode(service.request(PHONE, 'passenger', IP), 'resend_too_soon');
    expect(err.retryAfterSeconds).toBe(OTP_LIMITS.resendSeconds);
    expect(err.getStatus()).toBe(429);
    expect(sent).toHaveLength(1);
  });

  it('caps codes per phone per hour', async () => {
    const { service, redis, sent } = setup();
    for (let i = 0; i < OTP_LIMITS.maxPerPhonePerHour; i++) {
      await service.request(PHONE, 'passenger', IP);
      redis.expireNow('otp:cd:');
    }
    await expectCode(service.request(PHONE, 'passenger', IP), 'rate_limited');
    expect(sent).toHaveLength(OTP_LIMITS.maxPerPhonePerHour);
    // A different number is unaffected.
    await expect(service.request('+923217654321', 'passenger', IP)).resolves.toBeDefined();
  });

  it('caps codes per IP per hour', async () => {
    const { service } = setup();
    for (let i = 0; i < MAX_PER_IP; i++) {
      await service.request(`+92300${String(i).padStart(7, '0')}`, 'passenger', IP);
    }
    await expectCode(service.request('+923339999999', 'passenger', IP), 'rate_limited');
  });

  it('a new code replaces the old one', async () => {
    const { service, redis, lastCode } = setup();
    await service.request(PHONE, 'passenger', IP);
    const first = lastCode();
    redis.expireNow('otp:cd:');
    await service.request(PHONE, 'passenger', IP);
    const second = lastCode();
    if (first !== second) await expectCode(service.verify(PHONE, 'passenger', first), 'invalid_code');
    await expect(service.verify(PHONE, 'passenger', second)).resolves.toBeUndefined();
  });
});
