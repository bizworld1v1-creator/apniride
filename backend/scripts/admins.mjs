// Manage who can sign in to the admin panel. Talks straight to the database (DATABASE_URL in backend/.env).
//
//   pnpm admins list
//   pnpm admins add     <phone> "<name>"   e.g. pnpm admins add 03001234567 "Sana Malik"
//   pnpm admins disable <phone>            blocks sign-in and every admin request at once
//   pnpm admins enable  <phone>
import pg from 'pg';

function fail(message) {
  console.error(message);
  process.exit(1);
}

/** Same rules as normalizePkMobile in packages/shared. */
function toE164(input) {
  let d = String(input ?? '').trim().replace(/[\s\-().]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  const national = d.startsWith('92') ? d.slice(2) : d.startsWith('0') ? d.slice(1) : d;
  const e164 = `+92${national}`;
  return /^\+923\d{9}$/.test(e164) ? e164 : null;
}

const usage = `Usage:
  pnpm admins list
  pnpm admins add     <phone> "<name>"
  pnpm admins disable <phone>
  pnpm admins enable  <phone>`;

const [command, phoneArg, ...nameParts] = process.argv.slice(2);
if (!process.env.DATABASE_URL) fail('DATABASE_URL is not set (copy backend/.env.example to backend/.env).');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  if (command === 'list') {
    const { rows } = await pool.query(
      `SELECT u.phone, u.name, a.created_at, a.disabled_at FROM admins a JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at`,
    );
    if (!rows.length) console.log('No admins yet. Add one with: pnpm admins add 03001234567 "Your Name"');
    for (const r of rows) {
      console.log(`${r.disabled_at ? 'disabled' : 'active  '}  ${r.phone}  ${r.name ?? '?'}`);
    }
  } else if (command === 'add' || command === 'disable' || command === 'enable') {
    const phone = toE164(phoneArg);
    if (!phone) fail(`"${phoneArg ?? ''}" is not a Pakistani mobile number.\n\n${usage}`);
    if (command === 'add') {
      const name = nameParts.join(' ').trim();
      if (name.length < 2) fail(`Give the admin's name, e.g.: pnpm admins add ${phoneArg} "Sana Malik"`);
      // The same number may already use the passenger or driver app: reuse that user, keep their name if set.
      const { rows } = await pool.query(
        `INSERT INTO users (phone, name) VALUES ($1, $2)
         ON CONFLICT (phone) DO UPDATE SET name = COALESCE(users.name, EXCLUDED.name)
         RETURNING id`,
        [phone, name],
      );
      await pool.query(
        `INSERT INTO admins (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET disabled_at = NULL`,
        [rows[0].id],
      );
      console.log(`${phone} can now sign in to the admin panel.`);
    } else {
      const { rowCount } = await pool.query(
        `UPDATE admins SET disabled_at = ${command === 'disable' ? 'now()' : 'NULL'}
          WHERE user_id = (SELECT id FROM users WHERE phone = $1)`,
        [phone],
      );
      if (!rowCount) fail(`${phone} is not an admin.`);
      console.log(`${phone} ${command === 'disable' ? 'can no longer' : 'can again'} use the admin panel.`);
    }
  } else {
    console.log(usage);
  }
} catch (err) {
  fail(err.message);
} finally {
  await pool.end();
}
