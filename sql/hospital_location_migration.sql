-- Hospital profile/location updates for maps and signup forms.

ALTER TABLE public.hospitals
  ADD COLUMN IF NOT EXISTS city VARCHAR(255),
  ADD COLUMN IF NOT EXISTS state VARCHAR(255);

COMMENT ON COLUMN public.hospitals.city IS
  'City where the hospital is located.';
COMMENT ON COLUMN public.hospitals.state IS
  'State where the hospital is located.';
