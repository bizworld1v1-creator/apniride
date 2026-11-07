-- One admin, signed in with a username + password from backend/.env (ADMIN_USERNAME / ADMIN_PASSWORD) instead of
-- phone OTP. The admin's user row has no phone number. Older phone-based admins (no username) can't get in any more.
ALTER TABLE admins ADD COLUMN username text UNIQUE;
-- Fingerprint (HMAC) of the username + password the admin last signed in with. Every admin request checks it
-- against the current .env values, so changing ADMIN_PASSWORD (or ADMIN_USERNAME) signs the admin out at once.
ALTER TABLE admins ADD COLUMN login_fingerprint text;
