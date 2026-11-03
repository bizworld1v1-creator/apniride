-- Drivers (minimal until onboarding: vehicle type + approval), rides, and the offers made to drivers.

CREATE TABLE drivers (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type     text NOT NULL CHECK (vehicle_type IN ('bike', 'car')),
  approval_status  text NOT NULL DEFAULT 'pending'
                   CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rides (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id       uuid NOT NULL REFERENCES users(id),
  driver_id          uuid REFERENCES users(id),
  status             text NOT NULL CHECK (status IN
                       ('searching', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_driver')),
  city               text NOT NULL,
  vehicle_type       text NOT NULL CHECK (vehicle_type IN ('bike', 'car')),
  pickup             geography(Point, 4326) NOT NULL,
  dropoff            geography(Point, 4326) NOT NULL,
  -- Copied from the fare quote: the passenger pays exactly this (whole rupees).
  fare               integer NOT NULL CHECK (fare >= 0),
  distance_km        numeric(6, 1) NOT NULL,
  duration_min       integer NOT NULL,
  -- One booking per quote.
  quote_id           uuid NOT NULL UNIQUE,
  cancelled_by       text CHECK (cancelled_by IN ('passenger', 'driver', 'system')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  -- Reset when a driver cancels and we search again; the search timeout counts from here.
  search_started_at  timestamptz NOT NULL DEFAULT now(),
  accepted_at        timestamptz,
  arrived_at         timestamptz,
  started_at         timestamptz,
  completed_at       timestamptz,
  cancelled_at       timestamptz
);

-- At most one active ride per passenger and per driver (also protects against double taps / retries).
CREATE UNIQUE INDEX rides_one_active_per_passenger ON rides (passenger_id)
  WHERE status IN ('searching', 'accepted', 'arrived', 'in_progress');
CREATE UNIQUE INDEX rides_one_active_per_driver ON rides (driver_id)
  WHERE status IN ('accepted', 'arrived', 'in_progress');
CREATE INDEX rides_created_at_idx ON rides (created_at);

-- Every offer sent to a driver and what happened (for disputes and acceptance-rate stats).
CREATE TABLE ride_offers (
  ride_id             uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  driver_id           uuid NOT NULL REFERENCES users(id),
  offered_at          timestamptz NOT NULL DEFAULT now(),
  responded_at        timestamptz,
  response            text CHECK (response IN ('accepted', 'declined', 'expired', 'cancelled')),
  pickup_distance_km  numeric(5, 1) NOT NULL,
  PRIMARY KEY (ride_id, driver_id)
);
CREATE INDEX ride_offers_driver_idx ON ride_offers (driver_id, offered_at);
