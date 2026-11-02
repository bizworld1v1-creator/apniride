# @apniride/backend

NestJS API + (soon) Socket.IO realtime server for ApniRide.

## Run locally

From the repo root:

```bash
pnpm db:up                         # Postgres + PostGIS and Redis in Docker
cp backend/.env.example backend/.env
pnpm backend                       # http://localhost:3000
curl http://localhost:3000/health
```

`GET /health` returns `200` with `status: "ok"` when Postgres (with PostGIS) and Redis are reachable,
otherwise `503` with `status: "degraded"` and per-service details.

## Scripts

| Command          | What it does                              |
| ---------------- | ----------------------------------------- |
| `pnpm start:dev` | Watch mode                                |
| `pnpm build`     | Compile to `dist/`                        |
| `pnpm test`      | Unit tests (Vitest)                       |
| `pnpm test:e2e`  | End-to-end tests (needs `pnpm db:up`)     |
| `pnpm lint`      | oxlint                                    |
