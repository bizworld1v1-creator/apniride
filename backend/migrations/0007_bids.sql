-- inDrive-style bidding: a ride request goes to several drivers at once; each may accept the passenger's price or
-- counter-offer (a "bid"); the passenger chooses one. See docs/rides.md.

ALTER TABLE ride_offers
  -- What the driver bid (the passenger's price or a counter-offer), and when. NULL if they never bid.
  ADD COLUMN bid_fare  integer CHECK (bid_fare > 0),
  ADD COLUMN bid_at    timestamptz;

-- accepted     the passenger chose this driver's bid
-- declined     the driver said no
-- expired      the driver did not answer in time
-- cancelled    the request was withdrawn (passenger cancelled)
-- bid_expired  the driver bid, but the passenger did not choose it in time
-- not_chosen   the passenger chose another driver
ALTER TABLE ride_offers DROP CONSTRAINT ride_offers_response_check;
ALTER TABLE ride_offers ADD CONSTRAINT ride_offers_response_check
  CHECK (response IN ('accepted', 'declined', 'expired', 'cancelled', 'bid_expired', 'not_chosen'));
