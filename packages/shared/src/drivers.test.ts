import { describe, expect, it } from 'vitest';
import {
  canEditDriverApplication,
  cnicGender,
  driverDetailsBodySchema,
  formatCnic,
  formatDate,
  normalizeCnic,
  normalizePlate,
  parseDate,
  plateSchema,
  REQUIRED_DRIVER_DOCUMENTS,
  todayInPakistan,
} from './drivers';

const firstIssue = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;

describe('CNIC', () => {
  it.each([
    ['35202-1234567-1', '3520212345671'],
    ['3520212345671', '3520212345671'],
    [' 35202 1234567 1 ', '3520212345671'],
  ])('normalizes %s', (input, out) => expect(normalizeCnic(input)).toBe(out));

  it.each(['', '35202-123456-1', '05202-1234567-1', '35202-1234567-12', 'abcde-1234567-1'])('rejects %j', (input) =>
    expect(normalizeCnic(input)).toBeNull(),
  );

  it('formats like the card', () => expect(formatCnic('3520212345671')).toBe('35202-1234567-1'));

  it('reads the gender hint from the last digit', () => {
    expect(cnicGender('3520212345671')).toBe('male');
    expect(cnicGender('3520212345672')).toBe('female');
    expect(cnicGender('123')).toBeNull();
  });
});

describe('dates', () => {
  it.each([
    ['2027-03-31', '2027-03-31'],
    ['31-03-2027', '2027-03-31'],
    ['31/3/2027', '2027-03-31'],
    ['01.12.2030', '2030-12-01'],
  ])('parses %s', (input, out) => expect(parseDate(input)).toBe(out));

  it.each(['31-02-2027', '2027-13-01', '2027/03/31', 'next year', ''])('rejects %j', (input) =>
    expect(parseDate(input)).toBeNull(),
  );

  it('formats for display', () => expect(formatDate('2027-03-31')).toBe('31-03-2027'));

  it('uses the Pakistan date (UTC+5)', () => {
    // 20:00 UTC on 31 Dec is already 1 Jan in Lahore.
    expect(todayInPakistan(new Date('2026-12-31T20:00:00Z'))).toBe('2027-01-01');
    expect(todayInPakistan(new Date('2026-12-31T18:00:00Z'))).toBe('2026-12-31');
  });
});

describe('number plates', () => {
  it.each([
    ['lea 1234', 'LEA-1234'],
    ['LEA-12-1234', 'LEA-12-1234'],
    ['  ict  ab_123 ', 'ICT-AB-123'],
  ])('normalizes %j', (input, out) => {
    expect(normalizePlate(input)).toBe(out);
    expect(plateSchema.parse(input)).toBe(out);
  });

  it.each(['LEA', '1234', 'AB', 'LEA-1234-5678-90-12', 'LE@-123'])('rejects %j', (input) =>
    expect(firstIssue(plateSchema.safeParse(input))).toBe('invalid_plate'),
  );
});

describe('driverDetailsBodySchema', () => {
  const valid = {
    gender: 'female',
    cnic: '35202-1234567-2',
    licenceNumber: 'lhr 12345',
    licenceExpiry: '31-12-2099',
    vehicle: { type: 'car', make: 'Suzuki', model: 'Alto', year: '2019', colour: 'White', plate: 'lea 1234' },
  };

  it('normalizes everything', () => {
    expect(driverDetailsBodySchema.parse(valid)).toEqual({
      gender: 'female',
      cnic: '3520212345672',
      licenceNumber: 'LHR12345',
      licenceExpiry: '2099-12-31',
      vehicle: { type: 'car', make: 'Suzuki', model: 'Alto', year: 2019, colour: 'White', plate: 'LEA-1234' },
    });
  });

  it.each([
    [{ cnic: '123' }, 'invalid_cnic'],
    [{ licenceExpiry: '01-01-2020' }, 'licence_expired'],
    [{ licenceExpiry: '2099-02-30' }, 'invalid_date'],
    [{ licenceNumber: 'ab' }, 'invalid_licence'],
  ])('rejects %j with %s', (patch, code) =>
    expect(firstIssue(driverDetailsBodySchema.safeParse({ ...valid, ...patch }))).toBe(code),
  );

  it.each([
    [{ year: 1975 }, 'invalid_year'],
    [{ year: new Date().getFullYear() + 2 }, 'invalid_year'],
    [{ year: 'old' }, 'invalid_year'],
    [{ make: ' ' }, 'required'],
    [{ colour: 'x'.repeat(21) }, 'too_long'],
  ])('rejects vehicle %j with %s', (patch, code) =>
    expect(firstIssue(driverDetailsBodySchema.safeParse({ ...valid, vehicle: { ...valid.vehicle, ...patch } }))).toBe(
      code,
    ),
  );
});

describe('application rules', () => {
  it('only lets drivers edit before submitting or after a rejection', () => {
    expect(canEditDriverApplication('incomplete')).toBe(true);
    expect(canEditDriverApplication('rejected')).toBe(true);
    expect(canEditDriverApplication('pending')).toBe(false);
    expect(canEditDriverApplication('approved')).toBe(false);
    expect(canEditDriverApplication('suspended')).toBe(false);
  });

  it('does not require the police certificate yet', () => {
    expect(REQUIRED_DRIVER_DOCUMENTS).not.toContain('police_certificate');
    expect(REQUIRED_DRIVER_DOCUMENTS).toContain('cnic_front');
  });
});
