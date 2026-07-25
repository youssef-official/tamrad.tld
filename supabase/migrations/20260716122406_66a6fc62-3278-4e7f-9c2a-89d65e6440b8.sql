
ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS center_lat double precision,
  ADD COLUMN IF NOT EXISTS center_lng double precision,
  ADD COLUMN IF NOT EXISTS radius_km double precision;
