import { describe, expect, it } from 'vitest';
import { maskPhone, normalizePkMobile, pkMobileSchema, verifyOtpBodySchema } from './auth';

describe('normalizePkMobile', () => {
  it.each([
    ['03001234567', '+923001234567'],
    ['0300 1234567', '+923001234567'],
    ['0300-123-4567', '+923001234567'],
    ['3001234567', '+923001234567'],
    ['+92 300 1234567', '+923001234567'],
    ['923001234567', '+923001234567'],
    ['00923001234567', '+923001234567'],
    ['  +92 (321) 765-4321 ', '+923217654321'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePkMobile(input)).toBe(expected);
  });

  it.each([
    '',
    '0300123456', // too short
    '030012345678', // too long
    '04235761234', // Lahore landline, not mobile
    '+14155550123', // not Pakistan
    '0300abc4567',
    '++923001234567',
  ])('rejects %j', (input) => {
    expect(normalizePkMobile(input)).toBeNull();
  });
});

describe('maskPhone', () => {
  it('shows only the last 4 digits', () => {
    expect(maskPhone('+923001234567')).toBe('+92 3•• ••• 4567');
    expect(maskPhone('+923001234567')).not.toContain('300');
  });
});

describe('schemas', () => {
  it('pkMobileSchema outputs E.164', () => {
    expect(pkMobileSchema.parse('0300 1234567')).toBe('+923001234567');
    expect(pkMobileSchema.safeParse('12345').success).toBe(false);
  });

  it('verifyOtpBodySchema requires a 6-digit code', () => {
    const base = { phone: '03001234567', role: 'passenger' };
    expect(verifyOtpBodySchema.safeParse({ ...base, code: '123456' }).success).toBe(true);
    expect(verifyOtpBodySchema.safeParse({ ...base, code: '12345' }).success).toBe(false);
    expect(verifyOtpBodySchema.safeParse({ ...base, code: '12345a' }).success).toBe(false);
  });
});
