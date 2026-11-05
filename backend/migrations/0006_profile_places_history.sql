-- Side menu: profile photo, account deletion, saved places, and fast ride-history lists.

-- Profile photo (private file storage, like driver documents). Bumped on every change so apps can cache it.
ALTER TABLE users ADD COLUMN photo_key text;
ALTER TABLE users ADD COLUMN photo_updated_at timestamptz;

-- Account deletion: the phone number and name are removed and every session ends. The user row stays so past
-- rides (and complaints about them) still make sense; a deleted number can sign up again as a new account.
ALTER TABLE users ADD COLUMN deleted_at timestamptz;
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_deleted_has_no_phone CHECK (deleted_at IS NULL OR phone IS NULL);

-- Home, Work and other favourite places for faster booking. No addresses: we don't geocode (paid API),
-- the passenger names the place.
CREATE TABLE saved_places (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('home', 'work', 'other')),
  label       text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 40),
  location    geography(Point, 4326) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
-- One Home and one Work per person.
CREATE UNIQUE INDEX saved_places_one_home_work ON saved_places (user_id, kind) WHERE kind IN ('home', 'work');
CREATE INDEX saved_places_user_idx ON saved_places (user_id, created_at);

-- Ride history, newest first, for passengers and drivers (keyset pagination on created_at, id).
CREATE INDEX rides_passenger_history_idx ON rides (passenger_id, created_at DESC, id DESC);
CREATE INDEX rides_driver_history_idx ON rides (driver_id, created_at DESC, id DESC) WHERE driver_id IS NOT NULL;
