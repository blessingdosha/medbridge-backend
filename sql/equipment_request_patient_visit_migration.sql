-- Patient visit scheduling + facility ownership for cross-hospital request access.
-- Run after base schema and tenancy migration: npm run migrate (or psql -f ...).

ALTER TABLE public.facilities
  ADD COLUMN IF NOT EXISTS hospital_id INTEGER REFERENCES public.hospitals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_facilities_hospital_id ON public.facilities (hospital_id);

ALTER TABLE public.equipment_requests
  ADD COLUMN IF NOT EXISTS patient_visit_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS patient_visit_instructions TEXT,
  ADD COLUMN IF NOT EXISTS patient_visit_set_at TIMESTAMPTZ;

COMMENT ON COLUMN public.equipment_requests.patient_visit_at IS
  'When the patient should attend (set by the receiving / equipment facility).';
COMMENT ON COLUMN public.equipment_requests.patient_visit_instructions IS
  'Short instructions for the patient (e.g. fasting, documents to bring).';
