#!/usr/bin/env node
// `pnpm dev`: starts everything for local development with one command.
//   1. Postgres + Redis in Docker (waits until they are healthy)
//   2. Database migrations
//   3. Backend (API + Socket.IO, port 3000), mobile app (Expo, port 8081), admin panel (port 3001), all at once
//      through Turborepo, with the laptop's Wi-Fi IP so phones can reach Expo and the backend.
// The single commands (pnpm backend, pnpm mobile, pnpm admin, …) still work for running one part.
import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';

// Commands are fixed strings (no user input), run through the shell so Windows finds pnpm.cmd / docker.exe.
function run(command, label) {
  const res = spawnSync(command, { stdio: 'inherit', shell: true });
  if (res.status !== 0) {
    console.error(`\n✖ ${label} failed. See the output above.`);
    process.exit(res.status ?? 1);
  }
}

/** The laptop's LAN address: skips WSL / Docker / Hyper-V / VPN adapters, which confuse Expo's own guess. */
function lanAddress() {
  const virtual = /vEthernet|WSL|Docker|VirtualBox|VMware|Hyper-V|Loopback|Tailscale|ZeroTier|br-|docker|veth/i;
  const candidates = [];
  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    if (virtual.test(name)) continue;
    for (const a of addresses ?? []) {
      if (a.family === 'IPv4' && !a.internal) candidates.push({ name, address: a.address });
    }
  }
  // Home Wi-Fi routers usually hand out 192.168.x.x; prefer Wi-Fi adapters, then any private range.
  const score = ({ name, address }) =>
    (/wi-?fi|wlan|wireless/i.test(name) ? 4 : 0) +
    (address.startsWith('192.168.') ? 2 : 0) +
    (/^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(address) ? 1 : 0);
  candidates.sort((a, b) => score(b) - score(a));
  return candidates[0]?.address ?? null;
}

// 1. Docker must be running (Docker Desktop on Windows / Mac).
if (spawnSync('docker info', { stdio: 'ignore', shell: true }).status !== 0) {
  console.error('✖ Docker is not running. Start Docker Desktop, wait until it says "Engine running", then run pnpm dev again.');
  process.exit(1);
}
console.log('▶ Starting Postgres + Redis…');
run('docker compose up -d --wait', 'Starting the database');

// 2. Migrations (safe to run every time).
console.log('▶ Applying database migrations…');
run('pnpm --silent --filter @apniride/backend migrate', 'Database migrations');

// 3. Everything else.
const host = process.env.REACT_NATIVE_PACKAGER_HOSTNAME || lanAddress();
const env = { ...process.env };
if (host) env.REACT_NATIVE_PACKAGER_HOSTNAME = host;
const shown = host ?? 'localhost';

console.log(`
✔ Database ready. Starting backend, app and admin panel…

   Backend      http://${shown}:3000/health   (open it on the phone to check it can reach the laptop)
   Mobile app   scan the QR code in the "@apniride/mobile" output with Expo Go,
                or in Expo Go → "Enter URL manually": exp://${shown}:8081
   Admin panel  http://localhost:3001

   Stop everything with Ctrl + C. (The database keeps running; pnpm db:down stops it.)
   Wrong IP? Set it yourself: $env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.x.x"; pnpm dev
`);

// Extra arguments go to turbo, e.g. pnpm dev --filter=!@apniride/admin (everything except the admin panel).
const extra = process.argv.slice(2).map((a) => (/^[\w@/=!.:-]+$/.test(a) ? a : JSON.stringify(a))).join(' ');
const child = spawn(`pnpm exec turbo run dev ${extra}`.trim(), { stdio: 'inherit', env, shell: true });
child.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
