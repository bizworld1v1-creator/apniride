// Review driver applications from the terminal until the admin panel exists.
// Talks to the running backend (pnpm backend) with ADMIN_API_KEY from backend/.env.
//
//   pnpm drivers list [pending|approved|rejected|suspended|incomplete]
//   pnpm drivers show    <phone or id>
//   pnpm drivers photos  <phone or id>          saves the document photos to backend/uploads/review/<phone>/
//   pnpm drivers approve <phone or id>
//   pnpm drivers reject  <phone or id> "reason the driver will see"
//   pnpm drivers suspend <phone or id> "reason the driver will see"
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const KEY = process.env.ADMIN_API_KEY;
const REVIEW_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', process.env.UPLOAD_DIR ?? 'uploads', 'review');

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function call(method, urlPath, body) {
  let res;
  try {
    res = await fetch(`${BASE}${urlPath}`, {
      method,
      headers: { 'X-Admin-Key': KEY, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    fail(`Can't reach the backend at ${BASE}. Start it with: pnpm backend`);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    fail(`Error ${res.status}: ${err.code ?? ''} ${err.message ?? ''}`.trim());
  }
  return res;
}

const json = async (method, urlPath, body) => (await call(method, urlPath, body)).json();

/** "0300 1234567", "+923001234567" or a driver id → driver id. */
async function findDriver(who) {
  if (!who) fail('Say which driver: their phone number or id.');
  if (/^[0-9a-f-]{36}$/i.test(who)) return who;
  const digits = who.replace(/\D/g, '');
  const e164 = digits.startsWith('92') ? `+${digits}` : `+92${digits.replace(/^0/, '')}`;
  const all = await json('GET', '/admin/drivers');
  const match = all.find((d) => d.phone === e164);
  if (!match) fail(`No driver with phone ${e164}.`);
  return match.id;
}

function printSummary(d) {
  const when = d.submittedAt ? `submitted ${new Date(d.submittedAt).toLocaleString()}` : 'not submitted';
  console.log(`${d.status.padEnd(10)} ${d.phone}  ${(d.name ?? '?').padEnd(20)} ${d.vehicleType.padEnd(4)} ${d.gender ?? '-'}  ${when}  ${d.id}`);
}

function printDetail(d) {
  printSummary(d);
  if (d.details) {
    const v = d.details.vehicle;
    const cnic = d.details.cnic.replace(/^(\d{5})(\d{7})(\d)$/, '$1-$2-$3');
    console.log(`  CNIC        ${cnic}${d.cnicGenderMatches === false ? '   ⚠ last digit does not match the gender: check the card' : ''}`);
    console.log(`  Licence     ${d.details.licenceNumber}, valid until ${d.details.licenceExpiry}`);
    console.log(`  Vehicle     ${v.type}: ${v.make} ${v.model} ${v.year}, ${v.colour}, plate ${v.plate}`);
  } else {
    console.log('  (no details yet)');
  }
  console.log(`  Photos      ${d.documents.map((x) => x.type).join(', ') || 'none'}`);
  if (d.missingDocuments.length) console.log(`  Missing     ${d.missingDocuments.join(', ')}`);
  if (d.reviewNote) console.log(`  Note        ${d.reviewNote}`);
}

if (!KEY) fail('ADMIN_API_KEY is not set in backend/.env (see .env.example).');

const [command, who, ...rest] = process.argv.slice(2);
switch (command) {
  case 'list': {
    const rows = await json('GET', `/admin/drivers${who ? `?status=${who}` : ''}`);
    if (!rows.length) console.log('No drivers.');
    rows.forEach(printSummary);
    break;
  }
  case 'show':
    printDetail(await json('GET', `/admin/drivers/${await findDriver(who)}`));
    break;
  case 'photos': {
    const id = await findDriver(who);
    const d = await json('GET', `/admin/drivers/${id}`);
    const dir = path.join(REVIEW_DIR, d.phone.replace('+', ''));
    await mkdir(dir, { recursive: true });
    for (const doc of d.documents) {
      const res = await call('GET', `/admin/drivers/${id}/documents/${doc.type}`);
      const ext = res.headers.get('content-type') === 'image/png' ? 'png' : 'jpg';
      await writeFile(path.join(dir, `${doc.type}.${ext}`), Buffer.from(await res.arrayBuffer()));
    }
    console.log(`Saved ${d.documents.length} photo(s) to ${dir}`);
    console.log('These are personal documents: delete the folder when you are done.');
    break;
  }
  case 'approve':
    printDetail(await json('POST', `/admin/drivers/${await findDriver(who)}/approve`));
    break;
  case 'reject':
  case 'suspend': {
    const reason = rest.join(' ').trim();
    if (!reason) fail(`Give a reason the driver will see, e.g.: pnpm drivers ${command} 03001234567 "CNIC photo is blurry"`);
    printDetail(await json('POST', `/admin/drivers/${await findDriver(who)}/${command}`, { reason }));
    break;
  }
  default:
    console.log(`Usage:
  pnpm drivers list [pending|approved|rejected|suspended|incomplete]
  pnpm drivers show    <phone or id>
  pnpm drivers photos  <phone or id>
  pnpm drivers approve <phone or id>
  pnpm drivers reject  <phone or id> "reason"
  pnpm drivers suspend <phone or id> "reason"`);
}
