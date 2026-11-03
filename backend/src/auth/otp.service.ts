import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OTP_LENGTH, type RequestOtpResponse, type UserRole } from '@apniride/shared';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { Redis } from 'ioredis';
import { AppException } from '../common/app-exception.js';
import type { Env } from '../config/env.js';
import { REDIS } from '../redis/redis.module.js';
import { SmsSender } from './sms.sender.js';

export const OTP_LIMITS = {
  /** Code lifetime. */
  ttlSeconds: 5 * 60,
  /** Wait before another code can be sent to the same number. */
  resendSeconds: 60,
  /** Wrong guesses allowed per code before it is burned. */
  maxAttempts: 5,
  /** Codes per phone number per hour (SMS costs money; stops SMS bombing). */
  maxPerPhonePerHour: 5,
} as const;

const HOUR = 3600;

@Injectable()
export class OtpService {
  private readonly secret: string;
  private readonly devEcho: boolean;
  private readonly maxPerIpPerHour: number;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly sms: SmsSender,
    config: ConfigService<Env, true>,
  ) {
    this.secret = config.get('OTP_SECRET', { infer: true });
    this.devEcho = config.get('OTP_DEV_ECHO', { infer: true });
    this.maxPerIpPerHour = config.get('OTP_MAX_PER_IP_PER_HOUR', { infer: true });
  }

  /** Generates, stores (hashed) and sends a code. `phone` must already be E.164. */
  async request(phone: string, role: UserRole, ip: string): Promise<RequestOtpResponse> {
    const id = this.phoneId(phone);

    // 1. Cooldown: atomically claim the "recently sent" slot.
    const claimed = await this.redis.set(`otp:cd:${id}`, '1', 'EX', OTP_LIMITS.resendSeconds, 'NX');
    if (!claimed) {
      const wait = await this.ttl(`otp:cd:${id}`, OTP_LIMITS.resendSeconds);
      throw new AppException(HttpStatus.TOO_MANY_REQUESTS, 'resend_too_soon', 'Please wait before requesting another code', wait);
    }

    // 2. Hourly caps per phone and per IP.
    await this.enforceHourlyCap(`otp:hr:${id}`, OTP_LIMITS.maxPerPhonePerHour);
    await this.enforceHourlyCap(`otp:ip:${this.hmac(ip).slice(0, 32)}`, this.maxPerIpPerHour);

    // 3. Store the hash of a fresh code (replaces any previous code for this number).
    const code = randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
    const key = `otp:code:${id}`;
    await this.redis.hset(key, { hash: this.codeHash(phone, code), role, attempts: '0' });
    await this.redis.expire(key, OTP_LIMITS.ttlSeconds);

    await this.sms.send(phone, `ApniRide code: ${code}. Kisi ko na batayen. Do not share it.`);

    return {
      expiresInSeconds: OTP_LIMITS.ttlSeconds,
      resendInSeconds: OTP_LIMITS.resendSeconds,
      ...(this.devEcho ? { devCode: code } : {}),
    };
  }

  /** Throws unless `code` is the current code for this phone + role. A code works only once. */
  async verify(phone: string, role: UserRole, code: string): Promise<void> {
    const key = `otp:code:${this.phoneId(phone)}`;
    const stored = await this.redis.hgetall(key);
    if (!stored.hash) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'code_expired', 'Code expired or not requested');
    }

    // Count the attempt before checking, so parallel guesses can't exceed the limit.
    const attempts = await this.redis.hincrby(key, 'attempts', 1);
    if (attempts > OTP_LIMITS.maxAttempts) {
      await this.redis.del(key);
      throw new AppException(HttpStatus.TOO_MANY_REQUESTS, 'too_many_attempts', 'Too many wrong codes, request a new one');
    }

    const expected = Buffer.from(stored.hash, 'hex');
    const actual = Buffer.from(this.codeHash(phone, code), 'hex');
    const ok = stored.role === role && expected.length === actual.length && timingSafeEqual(expected, actual);
    if (!ok) throw new AppException(HttpStatus.BAD_REQUEST, 'invalid_code', 'Wrong code');

    // Single use. If del returns 0, a parallel request already consumed it.
    if ((await this.redis.del(key)) === 0) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'code_expired', 'Code already used');
    }
  }

  private async enforceHourlyCap(key: string, max: number) {
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, HOUR);
    if (count > max) {
      const wait = await this.ttl(key, HOUR);
      throw new AppException(HttpStatus.TOO_MANY_REQUESTS, 'rate_limited', 'Too many codes requested, try again later', wait);
    }
  }

  private async ttl(key: string, fallback: number) {
    const t = await this.redis.ttl(key);
    return t > 0 ? t : fallback;
  }

  private hmac(value: string) {
    return createHmac('sha256', this.secret).update(value).digest('hex');
  }

  /** Redis keys use a keyed hash of the phone so numbers aren't readable in Redis. */
  private phoneId(phone: string) {
    return this.hmac(`phone:${phone}`).slice(0, 32);
  }

  private codeHash(phone: string, code: string) {
    return this.hmac(`code:${phone}:${code}`);
  }
}
