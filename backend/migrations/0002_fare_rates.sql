-- Fare rates per city and vehicle type. Whole rupees (PKR). Editable later from the admin panel.
CREATE TABLE fare_rates (
  city            text    NOT NULL,
  vehicle_type    text    NOT NULL CHECK (vehicle_type IN ('bike', 'car')),
  base_fare       integer NOT NULL CHECK (base_fare >= 0),
  per_km          integer NOT NULL CHECK (per_km >= 0),
  per_min         integer NOT NULL CHECK (per_min >= 0),
  minimum_fare    integer NOT NULL CHECK (minimum_fare >= 0),
  -- Typical door-to-door speed in city traffic, used to estimate trip time.
  avg_speed_kmh   integer NOT NULL CHECK (avg_speed_kmh > 0),
  active          boolean NOT NULL DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (city, vehicle_type)
);

-- Starting rates for Lahore. PLACEHOLDERS: set real ones before launch.
-- Example: 11 km by road = Rs 310 by bike, Rs 770 by car (AC).
INSERT INTO fare_rates (city, vehicle_type, base_fare, per_km, per_min, minimum_fare, avg_speed_kmh) VALUES
  ('LHE', 'bike',  60, 18, 2, 120, 26),
  ('LHE', 'car',  150, 45, 4, 300, 22);
