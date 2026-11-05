import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  authSessionSchema,
  driverEarningsSchema,
  HISTORY_PAGE_SIZE,
  MAX_SAVED_PLACES,
  requestOtpResponseSchema,
  rideHistoryPageSchema,
  savedPlaceSchema,
  savedPlacesResponseSchema,
  type UserRole,
  userSchema,
} from '@apniride/shared';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { runMigrations } from '../scripts/migrate.mjs';
import { AppModule } from '../src/app.module.js';
import { PG_POOL } from '../src/database/database.module.js';
import { setupApp } from '../src/setup-app.js';

// Needs `pnpm db:up`. UPLOAD_DIR comes from vitest.config.e2e.ts.
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 7)]);
const HOME = { latitude: 31.33, longitude: 74.25 };

describe('Side menu: profile, saved places, history, account deletion (e2e)', () => {
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
    await app?.close();
  });

  async function signIn(role: UserRole, name: string) {
    const phone = `030${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
    const otp = requestOtpResponseSchema.parse(
      (await http().post('/auth/otp/request').send({ phone, role }).expect(200)).body,
    );
    const session = authSessionSchema.parse(
      (await http().post('/auth/otp/verify').send({ phone, role, code: otp.devCode }).expect(200)).body,
    );
    const auth = { Authorization: `Bearer ${session.accessToken}` };
    if (!session.user.name) await http().patch('/me').set(auth).send({ name }).expect(200);
    return { id: session.user.id, auth, refreshToken: session.refreshToken, phone };
  }

  /** A finished ride straight in the database (booking + dispatch are tested in rides.e2e-spec.ts). */
  async function finishedRide(
    passengerId: string,
    driverId: string | null,
    status: 'completed' | 'cancelled' | 'no_driver',
    fare: number,
    createdAt: string,
  ) {
    await pool.query(
      `INSERT INTO rides (passenger_id, driver_id, status, city, vehicle_type, pickup, dropoff, fare, distance_km,
                          duration_min, quote_id, created_at, completed_at, cancelled_at, cancelled_by)
       VALUES ($1, $2, $3, 'LHE', 'car', ST_SetSRID(ST_MakePoint(74.25, 31.33), 4326)::geography,
               ST_SetSRID(ST_MakePoint(74.27, 31.35), 4326)::geography, $4, 3.2, 12, $5, $6,
               CASE WHEN $3 = 'completed' THEN $6::timestamptz + interval '20 minutes' END,
               CASE WHEN $3 = 'cancelled' THEN $6::timestamptz + interval '2 minutes' END,
               CASE WHEN $3 = 'cancelled' THEN 'passenger' END)`,
      [passengerId, driverId, status, fare, randomUUID(), createdAt],
    );
  }

  it('edits the profile photo, private to the user', async () => {
    const p = await signIn('passenger', 'Ayesha Khan');
    expect(userSchema.parse((await http().get('/me').set(p.auth).expect(200)).body).photoUpdatedAt).toBeNull();
    await http().get('/me/photo').set(p.auth).expect(404);

    const bad = await http().put('/me/photo').set(p.auth).attach('file', Buffer.from('not a photo'), 'x.jpg').expect(400);
    expect(bad.body.code).toBe('invalid_image');

    const set = userSchema.parse((await http().put('/me/photo').set(p.auth).attach('file', JPEG, 'me.jpg').expect(200)).body);
    expect(set.photoUpdatedAt).toEqual(expect.any(String));
    const photo = await http().get('/me/photo').set(p.auth).expect(200);
    expect(photo.headers['content-type']).toBe('image/jpeg');
    expect(Buffer.compare(photo.body as Buffer, JPEG)).toBe(0);
    await http().get('/me/photo').expect(401);

    const removed = userSchema.parse((await http().delete('/me/photo').set(p.auth).expect(200)).body);
    expect(removed.photoUpdatedAt).toBeNull();
    await http().get('/me/photo').set(p.auth).expect(404);
  });

  it('saves Home / Work (one of each) and other places, private to the user', async () => {
    const p = await signIn('passenger', 'Ayesha Khan');
    const other = await signIn('passenger', 'Bilal Ahmed');

    const bad = await http().post('/me/places').set(p.auth).send({ kind: 'other', label: '  ', location: HOME }).expect(400);
    expect(bad.body.code).toBe('label_required');

    const home = savedPlaceSchema.parse(
      (await http().post('/me/places').set(p.auth).send({ kind: 'home', label: 'Home', location: HOME }).expect(201)).body,
    );
    // A second Home replaces the first.
    const moved = { latitude: 31.4, longitude: 74.3 };
    const home2 = savedPlaceSchema.parse(
      (await http().post('/me/places').set(p.auth).send({ kind: 'home', label: 'New home', location: moved }).expect(201)).body,
    );
    expect(home2.id).toBe(home.id);
    expect(home2.location.latitude).toBeCloseTo(31.4, 5);

    const gym = savedPlaceSchema.parse(
      (await http().post('/me/places').set(p.auth).send({ kind: 'other', label: 'Gym', location: HOME }).expect(201)).body,
    );
    await http().post('/me/places').set(p.auth).send({ kind: 'work', label: 'Office', location: HOME }).expect(201);
    const list = savedPlacesResponseSchema.parse((await http().get('/me/places').set(p.auth).expect(200)).body);
    expect(list.places.map((x) => x.kind)).toEqual(['home', 'work', 'other']);

    // Making "Gym" a second Work is refused; renaming it is fine.
    const clash = await http().put(`/me/places/${gym.id}`).set(p.auth).send({ kind: 'work', label: 'Gym', location: HOME }).expect(409);
    expect(clash.body.code).toBe('place_exists');
    await http().put(`/me/places/${gym.id}`).set(p.auth).send({ kind: 'other', label: 'Gym (new)', location: HOME }).expect(200);

    // Nobody else can see or change them.
    expect(savedPlacesResponseSchema.parse((await http().get('/me/places').set(other.auth).expect(200)).body).places).toEqual([]);
    await http().put(`/me/places/${gym.id}`).set(other.auth).send({ kind: 'other', label: 'Mine', location: HOME }).expect(404);
    await http().delete(`/me/places/${gym.id}`).set(other.auth).expect(204);

    await http().delete(`/me/places/${gym.id}`).set(p.auth).expect(204);
    await http().delete(`/me/places/${gym.id}`).set(p.auth).expect(204); // repeat is fine
    expect(savedPlacesResponseSchema.parse((await http().get('/me/places').set(p.auth).expect(200)).body).places).toHaveLength(2);

    // Limit on "other" places.
    for (let i = 0; i < MAX_SAVED_PLACES - 2; i++) {
      await http().post('/me/places').set(p.auth).send({ kind: 'other', label: `Place ${i}`, location: HOME }).expect(201);
    }
    const full = await http().post('/me/places').set(p.auth).send({ kind: 'other', label: 'One more', location: HOME }).expect(409);
    expect(full.body.code).toBe('too_many_places');
  });

  it('lists finished rides per mode, newest first, page by page, and the driver earnings', async () => {
    const passenger = await signIn('passenger', 'Ayesha Khan');
    const driver = await signIn('driver', 'Bilal Ahmed');
    const now = Date.now();
    const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
    // HISTORY_PAGE_SIZE + 3 completed rides with this driver, one cancelled, one nobody took.
    for (let i = 0; i < HISTORY_PAGE_SIZE + 3; i++) await finishedRide(passenger.id, driver.id, 'completed', 300, ago(60 + i));
    await finishedRide(passenger.id, driver.id, 'cancelled', 450, ago(30));
    await finishedRide(passenger.id, null, 'no_driver', 200, ago(10));
    // Two weeks ago: counts for "all time" only.
    await finishedRide(passenger.id, driver.id, 'completed', 1000, ago(14 * 24 * 60));

    const first = rideHistoryPageSchema.parse((await http().get('/rides/history').set(passenger.auth).expect(200)).body);
    expect(first.rides).toHaveLength(HISTORY_PAGE_SIZE);
    expect(first.rides[0]).toMatchObject({ status: 'no_driver', driver: null, endedAt: null });
    expect(first.rides[1]).toMatchObject({ status: 'cancelled', fare: 450, driver: { firstName: 'Bilal' } });
    expect(first.nextCursor).toEqual(expect.any(String));
    // Never phone numbers.
    expect(JSON.stringify(first)).not.toContain(driver.phone.slice(1));

    const second = rideHistoryPageSchema.parse(
      (await http().get('/rides/history').query({ cursor: first.nextCursor }).set(passenger.auth).expect(200)).body,
    );
    const total = HISTORY_PAGE_SIZE + 3 + 3;
    expect(second.rides).toHaveLength(total - HISTORY_PAGE_SIZE);
    expect(second.nextCursor).toBeNull();
    const ids = [...first.rides, ...second.rides].map((r) => r.id);
    expect(new Set(ids).size).toBe(total);
    const times = [...first.rides, ...second.rides].map((r) => r.createdAt);
    expect([...times].sort().reverse()).toEqual(times);

    // Driver mode: their rides only (no "no driver" ones), with the passenger's first name.
    const driverPage = rideHistoryPageSchema.parse((await http().get('/driver/rides/history').set(driver.auth).expect(200)).body);
    expect(driverPage.rides[0]).toMatchObject({ status: 'cancelled', passenger: { firstName: 'Ayesha' } });
    expect(driverPage.rides.every((r) => r.status !== 'no_driver')).toBe(true);

    // Each mode only.
    expect((await http().get('/driver/rides/history').set(passenger.auth).expect(403)).body.code).toBe('wrong_app');
    expect((await http().get('/rides/history').set(driver.auth).expect(403)).body.code).toBe('wrong_app');
    expect((await http().get('/rides/history').query({ cursor: 'nope' }).set(passenger.auth).expect(400)).body.code).toBe(
      'invalid_cursor',
    );

    const earnings = driverEarningsSchema.parse((await http().get('/driver/earnings').set(driver.auth).expect(200)).body);
    // The 60–83 minute old rides may fall before midnight in Pakistan when the test runs just after it.
    expect(earnings.today.rides).toBeLessThanOrEqual(HISTORY_PAGE_SIZE + 3);
    expect(earnings.last7Days).toEqual({ rides: HISTORY_PAGE_SIZE + 3, cash: (HISTORY_PAGE_SIZE + 3) * 300 });
    expect(earnings.allTime).toEqual({ rides: HISTORY_PAGE_SIZE + 4, cash: (HISTORY_PAGE_SIZE + 3) * 300 + 1000 });
  });

  it('deletes the account: refused while busy, then the number and data are gone', async () => {
    const p = await signIn('passenger', 'Ayesha Khan');
    const driver = await signIn('driver', 'Bilal Ahmed');
    await http().put('/me/photo').set(p.auth).attach('file', JPEG, 'me.jpg').expect(200);
    await http().post('/me/places').set(p.auth).send({ kind: 'home', label: 'Home', location: HOME }).expect(201);
    await finishedRide(p.id, driver.id, 'completed', 300, new Date().toISOString());

    // A ride going on blocks deletion.
    const activeQuote = randomUUID();
    await pool.query(
      `INSERT INTO rides (passenger_id, status, city, vehicle_type, pickup, dropoff, fare, distance_km, duration_min, quote_id)
       VALUES ($1, 'searching', 'LHE', 'car', ST_SetSRID(ST_MakePoint(74.25, 31.33), 4326)::geography,
               ST_SetSRID(ST_MakePoint(74.27, 31.35), 4326)::geography, 300, 3.2, 12, $2)`,
      [p.id, activeQuote],
    );
    expect((await http().delete('/me').set(p.auth).expect(409)).body.code).toBe('active_ride_exists');
    await pool.query(`UPDATE rides SET status = 'cancelled', cancelled_at = now() WHERE quote_id = $1`, [activeQuote]);

    await http().delete('/me').set(p.auth).expect(204);
    // Every session is over, and the old access token no longer gets the profile.
    await http().get('/me').set(p.auth).expect(401);
    expect((await http().post('/auth/refresh').send({ refreshToken: p.refreshToken }).expect(401)).body.code).toBe(
      'invalid_refresh_token',
    );
    const { rows } = await pool.query('SELECT phone, name, photo_key, deleted_at FROM users WHERE id = $1', [p.id]);
    expect(rows[0]).toMatchObject({ phone: null, name: null, photo_key: null, deleted_at: expect.any(Date) });
    expect((await pool.query('SELECT 1 FROM saved_places WHERE user_id = $1', [p.id])).rowCount).toBe(0);

    // The driver still sees the ride, without a name.
    const driverPage = rideHistoryPageSchema.parse((await http().get('/driver/rides/history').set(driver.auth).expect(200)).body);
    expect(driverPage.rides[0]!.passenger.firstName).toBe('');

    // The number is free again: signing up with it makes a brand-new account (this is the insert verifyOtp does;
    // asking for a real code again would hit the once-a-minute OTP limit for this number).
    const e164 = `+92${p.phone.slice(1)}`;
    const fresh = await pool.query<{ id: string }>('INSERT INTO users (phone) VALUES ($1) RETURNING id', [e164]);
    expect(fresh.rows[0]!.id).not.toBe(p.id);
    await pool.query('DELETE FROM users WHERE id = $1', [fresh.rows[0]!.id]);
  });
});
