-- Admin accounts (sign in to the admin panel with phone OTP) and an audit log of what they did.

ALTER TABLE auth_sessions DROP CONSTRAINT auth_sessions_role_check;
ALTER TABLE auth_sessions ADD CONSTRAINT auth_sessions_role_check CHECK (role IN ('passenger', 'driver', 'admin'));

-- Only numbers listed here can sign in to the admin panel. Added with `pnpm admins add`, never by signing up.
CREATE TABLE admins (
  user_id      uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- Set to block sign-in and every admin request at once (existing tokens stop working too).
  disabled_at  timestamptz
);

-- Every change an admin makes: who, what, to which record, and the details (e.g. old and new fare rates).
CREATE TABLE admin_audit_log (
  id           bigserial PRIMARY KEY,
  admin_id     uuid NOT NULL REFERENCES users(id),
  action       text NOT NULL,
  target_type  text NOT NULL,
  target_id    text NOT NULL,
  details      jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_log_target_idx ON admin_audit_log (target_type, target_id, created_at);
CREATE INDEX admin_audit_log_created_idx ON admin_audit_log (created_at);
