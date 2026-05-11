-- When equipment is free again for other hospitals after an approved booking window.
ALTER TABLE public.equipment_requests
  ADD COLUMN IF NOT EXISTS equipment_booking_end_at TIMESTAMPTZ;

COMMENT ON COLUMN public.equipment_requests.equipment_booking_end_at IS
  'End of equipment use for this booking; after this time the equipment is available network-wide again unless another approved booking applies.';
