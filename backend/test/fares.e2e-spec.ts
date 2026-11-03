import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { authSessionSchema, fareEstimateResponseSchema, requestOtpResponseSchema } from '@apniride/shared';
import type pg from 'pg';
import { runMigrations } from '../scripts/migrate.mjs';
import { AppModule } from '../src/app.module.js';
import { PG_POOL } from '../src/database/database.module.js';
import { FaresService } from '../src/fares/fares.service.js';

const LIBERTY = { latitude: 31.5104, longitude: 74.3416 };
const DATA_DARBAR = { latitude: 31.5799, longitude: 74.3093 };
const KARACHI = { latitude: 24.8607, longitude: 67.0011 };

// Needs `pnpm db:up` and backend/.env.
describe('POST /fares/estimate (e2e)', () => {
  let app: INestApplication<App>;
  let auth: { Authorization: string };
  let userId: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await runMigrations(app.get<pg.Pool>(PG_POOL), { log: () => {} });
    await app.init();

    const phone = `0301${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
    const otp = requestOtpResponseSchema.parse(
      (await http().post('/auth/otp/request').send({ phone, role: 'passenger' }).expect(200)).body,
    );
    const session = authSessionSchema.parse(
      (await http().post('/auth/otp/verify').send({ phone, role: 'passenger', code: otp.devCode }).expect(200)).body,
    );
    auth = { Authorization: `Bearer ${session.accessToken}` };
    userId = session.user.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('requires sign-in', async () => {
    await http().post('/fares/estimate').send({ pickup: LIBERTY, dropoff: DATA_DARBAR }).expect(401);
  });

  it('quotes fixed bike and car fares inside Lahore and keeps the quote for booking', async () => {
    const res = await http().post('/fares/estimate').set(auth).send({ pickup: LIBERTY, dropoff: DATA_DARBAR }).expect(200);
    const quote = fareEstimateResponseSchema.parse(res.body);

    expect(quote.city).toBe('LHE');
    expect(quote.distanceKm).toBeGreaterThan(10);
    expect(quote.distanceKm).toBeLessThan(13);
    expect(quote.options.map((o) => o.vehicleType)).toEqual(['bike', 'car']);
    const [bike, car] = quote.options;
    expect(bike!.fare % 10).toBe(0);
    expect(bike!.fare).toBeLessThan(car!.fare);

    const stored = await app.get(FaresService).getQuote(userId, quote.quoteId);
    expect(stored?.options).toEqual(quote.options);
    // Another user can't use this quote.
    expect(await app.get(FaresService).getQuote('someone-else', quote.quoteId)).toBeNull();
  });

  it('rejects trips outside the service area', async () => {
    const res = await http().post('/fares/estimate').set(auth).send({ pickup: LIBERTY, dropoff: KARACHI }).expect(422);
    expect(res.body.code).toBe('outside_service_area');
  });

  it('rejects trips that are too short', async () => {
    const nearby = { latitude: LIBERTY.latitude + 0.001, longitude: LIBERTY.longitude };
    const res = await http().post('/fares/estimate').set(auth).send({ pickup: LIBERTY, dropoff: nearby }).expect(422);
    expect(res.body.code).toBe('trip_too_short');
  });

  it('validates coordinates', async () => {
    const res = await http()
      .post('/fares/estimate')
      .set(auth)
      .send({ pickup: { latitude: 200, longitude: 74 }, dropoff: DATA_DARBAR })
      .expect(400);
    expect(res.body.code).toBe('validation_failed');
  });
});
