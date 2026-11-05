import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  authSessionSchema,
  type DriverPosition,
  fareEstimateResponseSchema,
  type LatLng,
  requestOtpResponseSchema,
  type Ride,
  type RideOffer,
  rideSchema,
  SOCKET_EVENTS,
  type UserRole,
  type VehicleType,
} from '@apniride/shared';
import type pg from 'pg';
import { io, type Socket } from 'socket.io-client';
import { runMigrations } from '../scripts/migrate.mjs';
import { AppModule } from '../src/app.module.js';
import { PG_POOL } from '../src/database/database.module.js';
import { setupApp } from '../src/setup-app.js';

// Needs `pnpm db:up` and backend/.env. Timeouts are shortened in vitest.config.e2e.ts.
// Rides happen near Raiwind (edge of the Lahore area) with a random offset, so a real driver
// testing the app in central Lahore never gets these offers.
const jitter = () => (Math.random() - 0.5) * 0.02;
const base = { latitude: 31.33 + jitter(), longitude: 74.25 + jitter() };
/** Each test rides in its own spot, > 5 km (the match radius) from the others. */
const spot = (dLat: number, dLng: number): LatLng => ({ latitude: base.latitude + dLat, longitude: base.longitude + dLng });
const DROPOFF: LatLng = spot(0.025, 0.01);

interface Actor {
  userId: string;
  auth: { Authorization: string };
  refreshToken: string;
  socket: Socket;
}

describe('Booking and dispatch (e2e)', () => {
  let app: INestApplication<App>;
  let url: string;
  const sockets: Socket[] = [];
  const drivers: Actor[] = [];
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await runMigrations(app.get<pg.Pool>(PG_POOL), { log: () => {} });
    await setupApp(app);
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });

  afterAll(async () => {
    for (const d of drivers) await http().post('/driver/offline').set(d.auth).catch(() => undefined);
    for (const s of sockets) s.disconnect();
    await app?.close();
  });

  async function signIn(role: UserRole, name: string): Promise<Actor> {
    const phone = `030${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
    const otp = requestOtpResponseSchema.parse(
      (await http().post('/auth/otp/request').send({ phone, role }).expect(200)).body,
    );
    const session = authSessionSchema.parse(
      (await http().post('/auth/otp/verify').send({ phone, role, code: otp.devCode }).expect(200)).body,
    );
    const auth = { Authorization: `Bearer ${session.accessToken}` };
    await http().patch('/me').set(auth).send({ name }).expect(200);
    const socket = io(url, { auth: { token: session.accessToken }, transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    const log: { event: string; payload: unknown; used: boolean }[] = [];
    received.set(socket, log);
    // Registered first, so it runs before any waiting handler and the log is always complete.
    socket.onAny((event: string, payload: unknown) => log.push({ event, payload, used: false }));
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    return { userId: session.user.id, auth, refreshToken: session.refreshToken, socket };
  }

  async function onlineDriver(vehicleType: VehicleType, at: LatLng): Promise<Actor> {
    const driver = await signIn('driver', 'Bilal Ahmed');
    drivers.push(driver);
    // Onboarding itself is tested in drivers.e2e-spec.ts; here we only need an approved driver.
    await app
      .get<pg.Pool>(PG_POOL)
      .query(`INSERT INTO drivers (user_id, vehicle_type, approval_status) VALUES ($1, $2, 'approved')`, [
        driver.userId,
        vehicleType,
      ]);
    const res = await http().post('/driver/online').set(driver.auth).send({ location: at }).expect(200);
    expect(res.body.online).toBe(true);
    return driver;
  }

  async function book(passenger: Actor, vehicleType: VehicleType, pickup: LatLng): Promise<Ride> {
    const quote = fareEstimateResponseSchema.parse(
      (await http().post('/fares/estimate').set(passenger.auth).send({ pickup, dropoff: DROPOFF }).expect(200)).body,
    );
    const res = await http().post('/rides').set(passenger.auth).send({ quoteId: quote.quoteId, vehicleType }).expect(201);
    const ride = rideSchema.parse(res.body);
    // Booking the same quote again (double tap / retry) returns the same ride.
    const again = await http().post('/rides').set(passenger.auth).send({ quoteId: quote.quoteId, vehicleType }).expect(201);
    expect(again.body.id).toBe(ride.id);
    return ride;
  }

  /** Every event each socket received, so a wait never misses one that arrived early. */
  const received = new WeakMap<Socket, { event: string; payload: unknown; used: boolean }[]>();

  function next<T>(socket: Socket, event: string, match: (p: T) => boolean = () => true, ms = 8000): Promise<T> {
    const log = received.get(socket)!;
    const take = () => {
      const hit = log.find((e) => !e.used && e.event === event && match(e.payload as T));
      if (hit) hit.used = true;
      return hit;
    };
    const early = take();
    if (early) return Promise.resolve(early.payload as T);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.offAny(handler);
        reject(new Error(`timed out waiting for ${event}`));
      }, ms);
      const handler = () => {
        const hit = take();
        if (!hit) return;
        clearTimeout(timer);
        socket.offAny(handler);
        resolve(hit.payload as T);
      };
      socket.onAny(handler);
    });
  }

  const offerFor = (driver: Actor, rideId: string) =>
    next<RideOffer>(driver.socket, SOCKET_EVENTS.rideOffer, (o) => o.rideId === rideId);
  const update = (actor: Actor, rideId: string, status: Ride['status'], ms?: number) =>
    next<Ride>(actor.socket, SOCKET_EVENTS.rideUpdate, (r) => r.id === rideId && r.status === status, ms);

  it('rejects sockets without a valid token', async () => {
    const socket = io(url, { auth: { token: 'nope' }, transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    const err = await new Promise<Error>((resolve) => socket.once('connect_error', resolve));
    expect(err.message).toBe('unauthorized');
  });

  it('keeps passenger and driver APIs apart', async () => {
    const passenger = await signIn('passenger', 'Sana');
    const res = await http().get('/driver/me').set(passenger.auth).expect(403);
    expect(res.body.code).toBe('wrong_app');
  });

  it('runs a full ride: offer → accept → arrived → start → complete', async () => {
    const pickup = spot(0, 0);
    const driver = await onlineDriver('car', { latitude: pickup.latitude + 0.003, longitude: pickup.longitude });
    const passenger = await signIn('passenger', 'Ayesha Khan');

    const ride = await book(passenger, 'car', pickup);
    expect(ride.status).toBe('searching');
    // No switching to driver mode in the middle of a ride.
    const switchMidRide = await http()
      .post('/auth/switch-role')
      .set(passenger.auth)
      .send({ role: 'driver', refreshToken: passenger.refreshToken })
      .expect(409);
    expect(switchMidRide.body.code).toBe('active_ride_exists');

    const offer = await offerFor(driver, ride.id);
    expect(offer).toMatchObject({ fare: ride.fare, vehicleType: 'car', passengerFirstName: 'Ayesha' });
    expect(offer.pickupDistanceKm).toBeLessThan(1);
    // A reconnecting driver app sees the same offer.
    expect((await http().get('/driver/current').set(driver.auth).expect(200)).body.offer.rideId).toBe(ride.id);

    const accepted = update(passenger, ride.id, 'accepted');
    const acceptRes = await http().post(`/driver/rides/${ride.id}/accept`).set(driver.auth).expect(200);
    expect(acceptRes.body.driver).toEqual({ firstName: 'Bilal' });
    expect((await accepted).driver).toEqual({ firstName: 'Bilal' });
    // No phone numbers anywhere in what the apps get.
    expect(JSON.stringify(acceptRes.body)).not.toMatch(/\+92|phone/i);

    // Live tracking: the driver's position reaches the passenger with an ETA to the pickup.
    const approach = { latitude: pickup.latitude + 0.01, longitude: pickup.longitude };
    const toPickup = next<DriverPosition>(passenger.socket, SOCKET_EVENTS.rideDriverLocation, (p) => p.rideId === ride.id);
    const ownEta = next<DriverPosition>(driver.socket, SOCKET_EVENTS.rideDriverLocation, (p) => p.rideId === ride.id);
    driver.socket.emit(SOCKET_EVENTS.driverLocation, { ...approach, heading: 180 });
    const pos = await toPickup;
    expect(pos).toMatchObject({ location: approach, heading: 180, ageSeconds: 0 });
    // The driver gets the same ETA for their own screen.
    expect(await ownEta).toEqual(pos);
    expect(pos.distanceKm).toBeCloseTo(1.5, 1);
    expect(pos.etaMin).toBeGreaterThan(0);
    // A passenger who reconnects can fetch it; nobody else can.
    const fetched = (await http().get(`/rides/${ride.id}/driver-location`).set(passenger.auth).expect(200)).body;
    expect(fetched.position.location).toEqual(approach);
    const stranger = await signIn('passenger', 'Stranger');
    await http().get(`/rides/${ride.id}/driver-location`).set(stranger.auth).expect(404);

    for (const [step, status] of [
      ['arrived', 'arrived'],
      ['start', 'in_progress'],
    ] as const) {
      const seen = update(passenger, ride.id, status);
      await http().post(`/driver/rides/${ride.id}/${step}`).set(driver.auth).expect(200);
      await seen;
    }

    // On board: the ETA now counts to the destination.
    const toDropoff = next<DriverPosition>(passenger.socket, SOCKET_EVENTS.rideDriverLocation, (p) => p.rideId === ride.id);
    driver.socket.emit(SOCKET_EVENTS.driverLocation, pickup);
    const onBoard = await toDropoff;
    expect(onBoard.distanceKm).toBeGreaterThan(2.5); // pickup → DROPOFF is ~3 km straight line

    const completed = update(passenger, ride.id, 'completed');
    await http().post(`/driver/rides/${ride.id}/complete`).set(driver.auth).expect(200);
    await completed;

    // After the ride, the passenger never sees the driver's location again.
    driver.socket.emit(SOCKET_EVENTS.driverLocation, approach);
    await new Promise((r) => setTimeout(r, 700));
    const leaked = received.get(passenger.socket)!.filter(
      (e) => e.event === SOCKET_EVENTS.rideDriverLocation && !e.used,
    );
    expect(leaked).toHaveLength(0);
    expect((await http().get(`/rides/${ride.id}/driver-location`).set(passenger.auth).expect(200)).body).toEqual({
      position: null,
    });
    // Retrying a step after a lost response is harmless.
    await http().post(`/driver/rides/${ride.id}/complete`).set(driver.auth).expect(200);

    expect((await http().get('/driver/current').set(driver.auth).expect(200)).body).toEqual({ offer: null, ride: null });
    expect((await http().get('/rides/current').set(passenger.auth).expect(200)).body).toEqual({ ride: null });
    expect((await http().get(`/rides/${ride.id}`).set(passenger.auth).expect(200)).body.status).toBe('completed');
  });

  it('shows available drivers near a passenger, without ids or exact positions', async () => {
    const here = spot(0.3, 0.3);
    const bike = await onlineDriver('bike', { latitude: here.latitude + 0.005, longitude: here.longitude });
    bike.socket.emit(SOCKET_EVENTS.driverLocation, {
      latitude: here.latitude + 0.0051234,
      longitude: here.longitude + 0.0000049,
      heading: 92.6,
    });
    await new Promise((r) => setTimeout(r, 300));
    const passenger = await signIn('passenger', 'Hina');
    const res = await http().get('/drivers/nearby').query(here).set(passenger.auth).expect(200);
    const mine = (res.body.drivers as { key: string; location: LatLng; heading: number; vehicleType: string }[]).filter(
      (d) => Math.abs(d.location.latitude - (here.latitude + 0.0051)) < 0.0002,
    );
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ vehicleType: 'bike', heading: 93 });
    expect(mine[0]!.key).not.toContain(bike.userId);
    // Rounded to 4 decimals (~11 m).
    expect(String(mine[0]!.location.latitude).split('.')[1]!.length).toBeLessThanOrEqual(4);
    // Same key on the next poll, so the app can glide the marker.
    const again = await http().get('/drivers/nearby').query(here).set(passenger.auth).expect(200);
    expect(again.body.drivers.map((d: { key: string }) => d.key)).toContain(mine[0]!.key);

    // Offline drivers disappear; outside Lahore there's nobody; drivers can't use it.
    await http().post('/driver/offline').set(bike.auth).expect(200);
    const after = await http().get('/drivers/nearby').query(here).set(passenger.auth).expect(200);
    expect(after.body.drivers.map((d: { key: string }) => d.key)).not.toContain(mine[0]!.key);
    const karachi = await http().get('/drivers/nearby').query({ latitude: 24.86, longitude: 67.0 }).set(passenger.auth);
    expect(karachi.body).toEqual({ drivers: [] });
    await http().get('/drivers/nearby').query(here).set(bike.auth).expect(403);
    await http().get('/drivers/nearby').query({ latitude: 'x', longitude: 1 }).set(passenger.auth).expect(400);
  });

  it('tells the passenger "no driver" when the only driver declines', async () => {
    const pickup = spot(-0.06, 0);
    const driver = await onlineDriver('bike', pickup);
    const passenger = await signIn('passenger', 'Hamza');

    const ride = await book(passenger, 'bike', pickup);
    await offerFor(driver, ride.id);
    const noDriver = update(passenger, ride.id, 'no_driver', 15_000);
    await http().post(`/driver/rides/${ride.id}/decline`).set(driver.auth).expect(204);
    expect((await noDriver).cancelledBy).toBe('system');
    // Too late to accept now.
    await http().post(`/driver/rides/${ride.id}/accept`).set(driver.auth).expect(410);
  });

  it('takes the offer back when the driver does not answer in time', async () => {
    const pickup = spot(0.06, 0);
    const driver = await onlineDriver('bike', pickup);
    const passenger = await signIn('passenger', 'Zainab');

    const ride = await book(passenger, 'bike', pickup);
    await offerFor(driver, ride.id);
    const cancelled = await next<{ rideId: string }>(
      driver.socket,
      SOCKET_EVENTS.rideOfferCancelled,
      (p) => p.rideId === ride.id,
      12_000,
    );
    expect(cancelled.rideId).toBe(ride.id);
    await http().post(`/driver/rides/${ride.id}/accept`).set(driver.auth).expect(410);
    await http().post(`/rides/${ride.id}/cancel`).set(passenger.auth).expect(200);
  });

  it('lets the passenger cancel while the offer is on the driver screen', async () => {
    const pickup = spot(0, -0.07);
    const driver = await onlineDriver('car', pickup);
    const passenger = await signIn('passenger', 'Omar');

    const ride = await book(passenger, 'car', pickup);
    await offerFor(driver, ride.id);
    const withdrawn = next<{ rideId: string }>(driver.socket, SOCKET_EVENTS.rideOfferCancelled, (p) => p.rideId === ride.id);
    const res = await http().post(`/rides/${ride.id}/cancel`).set(passenger.auth).expect(200);
    expect(res.body).toMatchObject({ status: 'cancelled', cancelledBy: 'passenger' });
    await withdrawn;
    // Cancelling twice is fine.
    await http().post(`/rides/${ride.id}/cancel`).set(passenger.auth).expect(200);
  });

  it('searches again when the driver cancels after accepting', async () => {
    const pickup = spot(0, 0.07);
    const first = await onlineDriver('car', pickup);
    const passenger = await signIn('passenger', 'Fatima');

    const ride = await book(passenger, 'car', pickup);
    await offerFor(first, ride.id);
    await http().post(`/driver/rides/${ride.id}/accept`).set(first.auth).expect(200);

    const second = await onlineDriver('car', pickup);
    const researching = update(passenger, ride.id, 'searching');
    const secondOffer = offerFor(second, ride.id);
    await http().post(`/driver/rides/${ride.id}/cancel`).set(first.auth).expect(200);
    expect((await researching).cancelledBy).toBe('driver');

    // The ride goes to the other driver, never back to the one who cancelled.
    await secondOffer;
    await http().post(`/driver/rides/${ride.id}/accept`).set(second.auth).expect(200);
    const current = (await http().get('/rides/current').set(passenger.auth).expect(200)).body.ride;
    expect(current).toMatchObject({ status: 'accepted', cancelledBy: null });
    await http().post(`/rides/${ride.id}/cancel`).set(passenger.auth).expect(200);
  });
});
