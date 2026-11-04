import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  adminDriverDetailSchema,
  authSessionSchema,
  type DriverDocumentType,
  driverOnboardingSchema,
  REQUIRED_DRIVER_DOCUMENTS,
  requestOtpResponseSchema,
  SOCKET_EVENTS,
  type UserRole,
} from '@apniride/shared';
import type pg from 'pg';
import { io, type Socket } from 'socket.io-client';
import { runMigrations } from '../scripts/migrate.mjs';
import { AppModule } from '../src/app.module.js';
import { PG_POOL } from '../src/database/database.module.js';
import { setupApp } from '../src/setup-app.js';

// Needs `pnpm db:up`. UPLOAD_DIR comes from vitest.config.e2e.ts.
import { removeTestAdmins, signInAdmin } from './admin-helpers.js';
// Raiwind, like the rides tests: far from where a real driver tests the app.
const LOCATION = { latitude: 31.33, longitude: 74.25 };
/** Only the first bytes matter: the server checks the JPEG signature. */
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 7)]);

/** A random valid CNIC (unique per run, so the "one account per CNIC" rule doesn't trip). lastDigit sets the gender hint. */
const randomCnic = (lastDigit: number) =>
  `${Math.floor(1 + Math.random() * 7)}${String(Math.floor(Math.random() * 1e11)).padStart(11, '0')}${lastDigit}`;

const details = (cnic: string) => ({
  gender: 'female',
  cnic,
  licenceNumber: 'LHR-123456',
  licenceExpiry: '31-12-2099',
  vehicle: { type: 'bike', make: 'Honda', model: 'CD 70', year: 2022, colour: 'Red', plate: 'lec 21 1234' },
});

describe('Driver onboarding and admin review (e2e)', () => {
  let app: INestApplication<App>;
  let url: string;
  const sockets: Socket[] = [];
  const http = () => request(app.getHttpServer());
  /** Authorization header of a signed-in admin. */
  let ADMIN: Record<string, string>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await runMigrations(app.get<pg.Pool>(PG_POOL), { log: () => {} });
    await setupApp(app);
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
    ADMIN = (await signInAdmin(app)).auth;
  });

  afterAll(async () => {
    if (app) await removeTestAdmins(app);
    for (const s of sockets) s.disconnect();
    await app?.close();
  });

  async function signIn(role: UserRole, name = 'Ayesha Khan') {
    const phone = `030${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
    const otp = requestOtpResponseSchema.parse(
      (await http().post('/auth/otp/request').send({ phone, role }).expect(200)).body,
    );
    const session = authSessionSchema.parse(
      (await http().post('/auth/otp/verify').send({ phone, role, code: otp.devCode }).expect(200)).body,
    );
    const auth = { Authorization: `Bearer ${session.accessToken}` };
    await http().patch('/me').set(auth).send({ name }).expect(200);
    return { id: session.user.id, auth, token: session.accessToken };
  }

  const upload = (auth: Record<string, string>, type: DriverDocumentType, data = JPEG, filename = 'photo.jpg') =>
    http().put(`/driver/onboarding/documents/${type}`).set(auth).attach('file', data, filename);

  async function uploadRequired(auth: Record<string, string>) {
    for (const type of REQUIRED_DRIVER_DOCUMENTS) await upload(auth, type).expect(200);
  }

  it('starts incomplete, and an incomplete driver cannot go online', async () => {
    const d = await signIn('driver');
    const res = await http().get('/driver/onboarding').set(d.auth).expect(200);
    expect(driverOnboardingSchema.parse(res.body)).toMatchObject({
      status: 'incomplete',
      details: null,
      documents: [],
      readyToSubmit: false,
      canEdit: true,
    });
    expect(res.body.missingDocuments).toEqual(REQUIRED_DRIVER_DOCUMENTS);
    expect((await http().get('/driver/me').set(d.auth).expect(200)).body).toMatchObject({
      approvalStatus: 'incomplete',
      vehicleType: null,
    });
    const online = await http().post('/driver/online').set(d.auth).send({ location: LOCATION }).expect(403);
    expect(online.body.code).toBe('driver_not_approved');
  });

  it('is only for the driver app', async () => {
    const p = await signIn('passenger');
    expect((await http().get('/driver/onboarding').set(p.auth).expect(403)).body.code).toBe('wrong_app');
  });

  it('validates details and documents', async () => {
    const d = await signIn('driver');
    // Photos need the details first (they create the driver profile).
    expect((await upload(d.auth, 'selfie').expect(409)).body.code).toBe('details_required');

    const bad = await http()
      .put('/driver/onboarding/details')
      .set(d.auth)
      .send({ ...details('123'), cnic: '123' })
      .expect(400);
    expect(bad.body.code).toBe('invalid_cnic');
    const expired = await http()
      .put('/driver/onboarding/details')
      .set(d.auth)
      .send({ ...details(randomCnic(2)), licenceExpiry: '01-01-2020' })
      .expect(400);
    expect(expired.body.code).toBe('licence_expired');

    await http().put('/driver/onboarding/details').set(d.auth).send(details(randomCnic(2))).expect(200);
    // Not a photo, whatever the name says.
    const pdf = await upload(d.auth, 'cnic_front', Buffer.from('%PDF-1.7 fake'), 'cnic.jpg').expect(400);
    expect(pdf.body.code).toBe('invalid_image');
    const tooBig = await upload(d.auth, 'cnic_front', Buffer.concat([JPEG, Buffer.alloc(5 * 1024 * 1024)])).expect(413);
    expect(tooBig.body.code).toBe('file_too_large');
    await http().put('/driver/onboarding/documents/passport').set(d.auth).attach('file', JPEG, 'x.jpg').expect(400);

    // Submitting with photos missing says which.
    const early = await http().post('/driver/onboarding/submit').set(d.auth).expect(409);
    expect(early.body.code).toBe('documents_missing');
  });

  it('allows one driver account per CNIC', async () => {
    const cnic = randomCnic(2);
    const first = await signIn('driver');
    await http().put('/driver/onboarding/details').set(first.auth).send(details(cnic)).expect(200);
    const second = await signIn('driver');
    const res = await http().put('/driver/onboarding/details').set(second.auth).send(details(cnic)).expect(409);
    expect(res.body.code).toBe('cnic_taken');
  });

  it('keeps the admin API for admins', async () => {
    await http().get('/admin/drivers').expect(401);
    const d = await signIn('driver');
    expect((await http().get('/admin/drivers').set(d.auth).expect(403)).body.code).toBe('not_admin');
  });

  it('goes through submit → reject → fix → resubmit → approve → online → suspend', async () => {
    const d = await signIn('driver', 'Ayesha Khan');
    const cnic = randomCnic(1); // odd last digit = male on the card, but she picked female
    const saved = await http().put('/driver/onboarding/details').set(d.auth).send(details(cnic)).expect(200);
    expect(saved.body.details).toEqual({
      gender: 'female',
      cnic,
      licenceNumber: 'LHR-123456',
      licenceExpiry: '2099-12-31',
      vehicle: { type: 'bike', make: 'Honda', model: 'CD 70', year: 2022, colour: 'Red', plate: 'LEC-21-1234' },
    });
    await uploadRequired(d.auth);
    // Replacing a photo is fine before submitting.
    const replaced = await upload(d.auth, 'selfie').expect(200);
    expect(replaced.body).toMatchObject({ readyToSubmit: true, missingDocuments: [] });
    expect(replaced.body.documents).toHaveLength(REQUIRED_DRIVER_DOCUMENTS.length);

    const submitted = await http().post('/driver/onboarding/submit').set(d.auth).expect(200);
    expect(submitted.body).toMatchObject({ status: 'pending', canEdit: false });
    expect(submitted.body.submittedAt).toEqual(expect.any(String));
    // Submitting again (lost response) is harmless; editing now is not allowed.
    await http().post('/driver/onboarding/submit').set(d.auth).expect(200);
    expect((await upload(d.auth, 'selfie').expect(409)).body.code).toBe('application_locked');
    const locked = await http().put('/driver/onboarding/details').set(d.auth).send(details(cnic)).expect(409);
    expect(locked.body.code).toBe('application_locked');

    // In the admin review queue, with the phone number and a CNIC/gender warning.
    const queue = await http().get('/admin/drivers?status=pending').set(ADMIN).expect(200);
    const entry = (queue.body as { id: string; phone: string }[]).find((x) => x.id === d.id);
    expect(entry).toMatchObject({ status: 'pending', gender: 'female', vehicleType: 'bike' });
    expect(entry?.phone).toMatch(/^\+923\d{9}$/);
    const detail = adminDriverDetailSchema.parse((await http().get(`/admin/drivers/${d.id}`).set(ADMIN).expect(200)).body);
    expect(detail.cnicGenderMatches).toBe(false);
    expect(detail.name).toBe('Ayesha Khan');

    const photo = await http().get(`/admin/drivers/${d.id}/documents/cnic_front`).set(ADMIN).expect(200);
    expect(photo.headers['content-type']).toBe('image/jpeg');
    expect(photo.headers['cache-control']).toBe('no-store');
    expect(Buffer.compare(photo.body as Buffer, JPEG)).toBe(0);
    await http().get(`/admin/drivers/${d.id}/documents/police_certificate`).set(ADMIN).expect(404);

    // Reject: needs a reason, which the driver sees; the driver app hears about it at once.
    const socket = io(url, { auth: { token: d.token }, transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    await http().post(`/admin/drivers/${d.id}/reject`).set(ADMIN).send({}).expect(400);
    const event = new Promise((resolve) => socket.once(SOCKET_EVENTS.driverReviewed, resolve));
    const rejected = await http()
      .post(`/admin/drivers/${d.id}/reject`)
      .set(ADMIN)
      .send({ reason: 'CNIC photo is blurry' })
      .expect(200);
    expect(rejected.body.status).toBe('rejected');
    // Audit trail: who did it and why.
    expect(rejected.body.history[0]).toMatchObject({
      action: 'driver.reject',
      adminName: 'Test Admin',
      details: { reason: 'CNIC photo is blurry' },
    });
    expect(await event).toEqual({ status: 'rejected' });
    const afterReject = await http().get('/driver/onboarding').set(d.auth).expect(200);
    expect(afterReject.body).toMatchObject({ status: 'rejected', canEdit: true, reviewNote: 'CNIC photo is blurry' });

    // Can't approve a rejected application directly: the driver must fix and resubmit.
    expect((await http().post(`/admin/drivers/${d.id}/approve`).set(ADMIN).expect(409)).body.code).toBe(
      'invalid_driver_state',
    );
    await upload(d.auth, 'cnic_front').expect(200);
    const resubmitted = await http().post('/driver/onboarding/submit').set(d.auth).expect(200);
    expect(resubmitted.body).toMatchObject({ status: 'pending', reviewNote: null });

    const approved = await http().post(`/admin/drivers/${d.id}/approve`).set(ADMIN).expect(200);
    expect(approved.body.status).toBe('approved');
    // Double click in the admin panel.
    await http().post(`/admin/drivers/${d.id}/approve`).set(ADMIN).expect(200);
    const online = await http().post('/driver/online').set(d.auth).send({ location: LOCATION }).expect(200);
    expect(online.body).toMatchObject({ online: true, vehicleType: 'bike', approvalStatus: 'approved' });

    // Suspend: offline at once and can't come back online.
    await http().post(`/admin/drivers/${d.id}/suspend`).set(ADMIN).send({ reason: 'Passenger complaint' }).expect(200);
    expect((await http().get('/driver/me').set(d.auth).expect(200)).body).toMatchObject({
      online: false,
      approvalStatus: 'suspended',
    });
    const blocked = await http().post('/driver/online').set(d.auth).send({ location: LOCATION }).expect(403);
    expect(blocked.body.code).toBe('driver_not_approved');
  });

  it('returns 404 for unknown drivers', async () => {
    await http().get('/admin/drivers/00000000-0000-4000-8000-000000000000').set(ADMIN).expect(404);
    await http().post('/admin/drivers/00000000-0000-4000-8000-000000000000/approve').set(ADMIN).expect(404);
  });
});
