import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  adminFareRateSchema,
  adminRideDetailSchema,
  adminRideSummarySchema,
  adminStatsSchema,
  authSessionSchema,
  fareEstimateResponseSchema,
  requestOtpResponseSchema,
} from '@apniride/shared';
import type pg from 'pg';
import { runMigrations } from '../scripts/migrate.mjs';
import { AppModule } from '../src/app.module.js';
import { PG_POOL } from '../src/database/database.module.js';
import { setupApp } from '../src/setup-app.js';
import { addAdmin, randomPhone, removeTestAdmins, signInAdmin, toE164 } from './admin-helpers.js';

// Needs `pnpm db:up`.
describe('Admin panel API (e2e)', () => {
  let app: INestApplication<App>;
  let pool: pg.Pool;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    pool = app.get<pg.Pool>(PG_POOL);
    await runMigrations(pool, { log: () => {} });
    await setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    if (app) await removeTestAdmins(app);
    await app?.close();
  });

  describe('sign-in', () => {
    it('signs in an admin with phone OTP', async () => {
      const admin = await signInAdmin(app, 'Sana Malik');
      expect(admin.session.user).toMatchObject({ role: 'admin', name: 'Sana Malik' });
      expect(admin.session.isNewUser).toBe(false);
      const me = await http().get('/admin/me').set(admin.auth).expect(200);
      expect(me.body).toEqual({ id: admin.id, name: 'Sana Malik', phoneMasked: expect.stringMatching(/^\+92 3•• ••• \d{4}$/) });
    });

    it('never creates an admin: other numbers get the normal response but no code', async () => {
      const phone = randomPhone();
      const res = await http().post('/auth/otp/request').send({ phone, role: 'admin' }).expect(200);
      const otp = requestOtpResponseSchema.parse(res.body);
      expect(otp.devCode).toBeUndefined();
      expect(otp.expiresInSeconds).toBeGreaterThan(0);
      await http().post('/auth/otp/verify').send({ phone, role: 'admin', code: '123456' }).expect(400);
      const { rowCount } = await pool.query('SELECT 1 FROM users WHERE phone = $1', [toE164(phone)]);
      expect(rowCount).toBe(0);
    });

    it('a passenger code does not open the admin panel', async () => {
      const phone = randomPhone();
      await addAdmin(app, phone);
      const otp = requestOtpResponseSchema.parse(
        (await http().post('/auth/otp/request').send({ phone, role: 'passenger' }).expect(200)).body,
      );
      const bad = await http().post('/auth/otp/verify').send({ phone, role: 'admin', code: otp.devCode }).expect(400);
      expect(bad.body.code).toBe('invalid_code');
      // And a passenger token is refused by the admin API.
      const session = authSessionSchema.parse(
        (await http().post('/auth/otp/verify').send({ phone, role: 'passenger', code: otp.devCode }).expect(200)).body,
      );
      const res = await http().get('/admin/me').set({ Authorization: `Bearer ${session.accessToken}` }).expect(403);
      expect(res.body.code).toBe('not_admin');
    });

    it('disabling an admin locks them out at once, even with a valid token', async () => {
      const admin = await signInAdmin(app);
      await http().get('/admin/stats').set(admin.auth).expect(200);
      await pool.query('UPDATE admins SET disabled_at = now() WHERE user_id = $1', [admin.id]);
      expect((await http().get('/admin/stats').set(admin.auth).expect(403)).body.code).toBe('not_admin');
    });
  });

  describe('data', () => {
    let admin: Awaited<ReturnType<typeof signInAdmin>>;
    beforeAll(async () => {
      admin = await signInAdmin(app, 'Ops Admin');
    });

    it('shows dashboard numbers', async () => {
      const stats = adminStatsSchema.parse((await http().get('/admin/stats').set(admin.auth).expect(200)).body);
      expect(stats.today.rides).toBeGreaterThanOrEqual(0);
    });

    it('lists rides with both parties and shows a ride with its offers', async () => {
      // A passenger books a ride near Raiwind (no drivers there), so it sits in "searching".
      const phone = randomPhone();
      const otp = requestOtpResponseSchema.parse(
        (await http().post('/auth/otp/request').send({ phone, role: 'passenger' }).expect(200)).body,
      );
      const session = authSessionSchema.parse(
        (await http().post('/auth/otp/verify').send({ phone, role: 'passenger', code: otp.devCode }).expect(200)).body,
      );
      const auth = { Authorization: `Bearer ${session.accessToken}` };
      await http().patch('/me').set(auth).send({ name: 'Zara Passenger' }).expect(200);
      const jitter = () => (Math.random() - 0.5) * 0.01;
      const pickup = { latitude: 31.3 + jitter(), longitude: 74.2 + jitter() };
      const dropoff = { latitude: pickup.latitude + 0.03, longitude: pickup.longitude + 0.01 };
      const quote = fareEstimateResponseSchema.parse(
        (await http().post('/fares/estimate').set(auth).send({ pickup, dropoff }).expect(200)).body,
      );
      const booked = await http().post('/rides').set(auth).send({ quoteId: quote.quoteId, vehicleType: 'car' }).expect(201);

      const list = adminRideSummarySchema
        .array()
        .parse((await http().get('/admin/rides?limit=20').set(admin.auth).expect(200)).body);
      const row = list.find((r) => r.id === booked.body.id);
      expect(row).toMatchObject({ passenger: { name: 'Zara Passenger', phone: toE164(phone) }, driver: null });

      // Paging: nothing from this ride's time onwards appears on the "before" page.
      const older = adminRideSummarySchema
        .array()
        .parse((await http().get(`/admin/rides?before=${encodeURIComponent(row!.createdAt)}`).set(admin.auth).expect(200)).body);
      expect(older.some((r) => r.id === row!.id)).toBe(false);

      const detail = adminRideDetailSchema.parse(
        (await http().get(`/admin/rides/${booked.body.id}`).set(admin.auth).expect(200)).body,
      );
      expect(detail.pickup.latitude).toBeCloseTo(pickup.latitude, 5);
      expect(detail.offers).toEqual([]);
      await http().post(`/rides/${booked.body.id}/cancel`).set(auth).expect(200);
      await http().get('/admin/rides/00000000-0000-4000-8000-000000000000').set(admin.auth).expect(404);
      await http().get('/admin/rides?status=nonsense').set(admin.auth).expect(400);
    });

    it('edits fare rates, logs the change, and new quotes use them', async () => {
      const rates = adminFareRateSchema.array().parse((await http().get('/admin/fare-rates').set(admin.auth).expect(200)).body);
      const bike = rates.find((r) => r.city === 'LHE' && r.vehicleType === 'bike')!;
      expect(bike.examples).toHaveLength(3);
      const original = {
        baseFare: bike.baseFare,
        perKm: bike.perKm,
        perMin: bike.perMin,
        minimumFare: bike.minimumFare,
        avgSpeedKmh: bike.avgSpeedKmh,
        active: bike.active,
      };
      try {
        const bad = await http()
          .put('/admin/fare-rates/LHE/bike')
          .set(admin.auth)
          .send({ ...original, minimumFare: 10, baseFare: 50 })
          .expect(400);
        expect(bad.body.code).toBe('minimum_below_base');
        await http().put('/admin/fare-rates/LHE/bike').set(admin.auth).send({ ...original, perKm: -1 }).expect(400);
        await http().put('/admin/fare-rates/KHI/bike').set(admin.auth).send(original).expect(400);

        // A small change: other e2e files run at the same time and quote bike fares.
        const res = await http()
          .put('/admin/fare-rates/LHE/bike')
          .set(admin.auth)
          .send({ ...original, perMin: original.perMin + 1 })
          .expect(200);
        const updated = adminFareRateSchema.parse(res.body);
        expect(updated.perMin).toBe(original.perMin + 1);
        // The 15 km example takes the longest, so its fare can't go down.
        expect(updated.examples[2]!.fare).toBeGreaterThanOrEqual(bike.examples[2]!.fare);

        const { rows } = await pool.query(
          `SELECT details FROM admin_audit_log WHERE admin_id = $1 AND action = 'fare_rate.update' ORDER BY id DESC LIMIT 1`,
          [admin.id],
        );
        expect(rows[0].details).toMatchObject({
          before: { perMin: original.perMin },
          after: { perMin: original.perMin + 1 },
        });
      } finally {
        await http().put('/admin/fare-rates/LHE/bike').set(admin.auth).send(original).expect(200);
      }
    });
  });
});
