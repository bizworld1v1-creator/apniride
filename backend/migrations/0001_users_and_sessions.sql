-- Users, the apps they use, and refresh-token sessions.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- E.164 Pakistani mobile. Never returned to other users' apps (masked calling only).
  phone       text NOT NULL UNIQUE CHECK (phone ~ '^\+923[0-9]{9}$'),
  name        text CHECK (char_length(name) BETWEEN 2 AND 60),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- One phone number can be a passenger and a driver.
CREATE TABLE user_roles (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('passenger', 'driver')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE auth_sessions (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role                      text NOT NULL CHECK (role IN ('passenger', 'driver')),
  -- SHA-256 of the refresh token; the token itself is never stored.
  refresh_token_hash        bytea NOT NULL UNIQUE,
  -- Previous hash, accepted for a short grace period after rotation so a refresh
  -- response lost on a weak connection doesn't sign the user out.
  prev_refresh_token_hash   bytea,
  rotated_at                timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  last_used_at              timestamptz NOT NULL DEFAULT now(),
  expires_at                timestamptz NOT NULL,
  revoked_at                timestamptz
);
CREATE INDEX auth_sessions_user_id_idx ON auth_sessions (user_id);
CREATE INDEX auth_sessions_prev_hash_idx ON auth_sessions (prev_refresh_token_hash)
  WHERE prev_refresh_token_hash IS NOT NULL;
