-- Driver onboarding: personal + vehicle details, document photos and the admin review.
-- See docs/drivers.md for the status flow.

ALTER TABLE drivers DROP CONSTRAINT drivers_approval_status_check;
ALTER TABLE drivers ADD CONSTRAINT drivers_approval_status_check
  CHECK (approval_status IN ('incomplete', 'pending', 'approved', 'rejected', 'suspended'));
ALTER TABLE drivers ALTER COLUMN approval_status SET DEFAULT 'incomplete';

ALTER TABLE drivers
  ADD COLUMN gender          text CHECK (gender IN ('male', 'female', 'other')),
  -- 13 digits, no dashes. Unique: one driver account per CNIC.
  ADD COLUMN cnic            text CHECK (cnic ~ '^[1-9][0-9]{12}$'),
  ADD COLUMN licence_number  text,
  ADD COLUMN licence_expiry  date,
  ADD COLUMN vehicle_make    text,
  ADD COLUMN vehicle_model   text,
  ADD COLUMN vehicle_year    smallint,
  ADD COLUMN vehicle_colour  text,
  ADD COLUMN vehicle_plate   text,
  ADD COLUMN submitted_at    timestamptz,
  ADD COLUMN reviewed_at     timestamptz,
  -- Rejection / suspension reason, shown to the driver.
  ADD COLUMN review_note     text;

CREATE UNIQUE INDEX drivers_cnic_unique ON drivers (cnic) WHERE cnic IS NOT NULL;
-- The admin review queue: pending first-come first-served.
CREATE INDEX drivers_status_submitted_idx ON drivers (approval_status, submitted_at);

-- Drivers created before onboarding existed (dev only: they were auto-approved) must onboard properly.
UPDATE drivers SET approval_status = 'incomplete' WHERE cnic IS NULL;

-- One current photo per document type. Files live in FileStorage (local disk in dev), never in a public folder.
CREATE TABLE driver_documents (
  driver_id     uuid NOT NULL REFERENCES drivers(user_id) ON DELETE CASCADE,
  type          text NOT NULL CHECK (type IN
                  ('selfie', 'cnic_front', 'cnic_back', 'licence', 'vehicle_registration', 'vehicle_photo',
                   'police_certificate')),
  storage_key   text NOT NULL,
  content_type  text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
  size_bytes    integer NOT NULL CHECK (size_bytes > 0),
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (driver_id, type)
);
