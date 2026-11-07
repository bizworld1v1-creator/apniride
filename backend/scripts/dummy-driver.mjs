// DEV ONLY. Adds ready-to-use test drivers that are already approved, so you can sign in to the driver app
// with their number and receive your own bookings without going through onboarding + admin approval.
//
//   pnpm dummy-driver           add / refresh the test drivers (safe to run again)
//   pnpm dummy-driver remove    delete them (and their rides)
//
// Sign in to the driver app with the number below. The OTP code is shown in the app (OTP_DEV_ECHO=true).
import pg from 'pg';

const DRIVERS = [
  {
    phone: '+923000000001',
    name: 'Test Car Driver',
    vehicleType: 'car',
    cnic: '3520200000001',
    make: 'Suzuki',
    model: 'Cultus',
    colour: 'White',
    plate: 'TEST-001',
  },
  {
    phone: '+923000000002',
    name: 'Test Bike Driver',
    vehicleType: 'bike',
    cnic: '3520200000002',
    make: 'Honda',
    model: 'CD 70',
    colour: 'Red',
    plate: 'TEST-002',
  },
];

const local = (e164) => `0${e164.slice(3)}`;

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to add test drivers when NODE_ENV=production.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set (copy backend/.env.example to backend/.env).');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const command = process.argv[2] ?? 'add';

try {
  if (command === 'remove') {
    const phones = DRIVERS.map((d) => d.phone);
    const { rows } = await pool.query('SELECT id FROM users WHERE phone = ANY($1)', [phones]);
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      await pool.query('DELETE FROM rides WHERE driver_id = ANY($1) OR passenger_id = ANY($1)', [ids]);
      await pool.query('DELETE FROM ride_offers WHERE driver_id = ANY($1)', [ids]);
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [ids]);
    }
    console.log(`Removed ${ids.length} test driver(s).`);
  } else if (command === 'add') {
    for (const d of DRIVERS) {
      const { rows } = await pool.query(
        `INSERT INTO users (phone, name) VALUES ($1, $2)
         ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
         RETURNING id`,
        [d.phone, d.name],
      );
      const userId = rows[0].id;
      await pool.query(
        `INSERT INTO user_roles (user_id, role) VALUES ($1, 'driver') ON CONFLICT DO NOTHING`,
        [userId],
      );
      await pool.query(
        `INSERT INTO drivers (user_id, vehicle_type, approval_status, gender, cnic, licence_number, licence_expiry,
                              vehicle_make, vehicle_model, vehicle_year, vehicle_colour, vehicle_plate,
                              submitted_at, reviewed_at, review_note)
         VALUES ($1, $2, 'approved', 'male', $3, $4, now() + interval '5 years', $5, $6, 2020, $7, $8,
                 now(), now(), 'Test driver added by pnpm dummy-driver')
         ON CONFLICT (user_id) DO UPDATE SET
           vehicle_type = EXCLUDED.vehicle_type, approval_status = 'approved', gender = EXCLUDED.gender,
           cnic = EXCLUDED.cnic, licence_number = EXCLUDED.licence_number, licence_expiry = EXCLUDED.licence_expiry,
           vehicle_make = EXCLUDED.vehicle_make, vehicle_model = EXCLUDED.vehicle_model,
           vehicle_year = EXCLUDED.vehicle_year, vehicle_colour = EXCLUDED.vehicle_colour,
           vehicle_plate = EXCLUDED.vehicle_plate, reviewed_at = now(), review_note = EXCLUDED.review_note,
           updated_at = now()`,
        [userId, d.vehicleType, d.cnic, `LHR-${d.plate}`, d.make, d.model, d.colour, d.plate],
      );
      console.log(`✔ ${d.vehicleType.padEnd(4)}  ${local(d.phone)}  ${d.name}  (approved)`);
    }
    console.log('\nSign in to the DRIVER app with one of these numbers. The code is shown in the app.');
    console.log('Then tap "Go online" and book from the passenger app with YOUR number.');
  } else {
    console.error('Usage:\n  pnpm dummy-driver\n  pnpm dummy-driver remove');
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}
