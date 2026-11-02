import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { healthResponseSchema } from '@apniride/shared';
import { AppModule } from './../src/app.module.js';

// Needs `pnpm db:up` (Postgres + PostGIS and Redis running) and backend/.env.
describe('GET /health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns ok with PostGIS and Redis up', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    const body = healthResponseSchema.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.services.postgres.postgis).toBeTruthy();
  });
});
