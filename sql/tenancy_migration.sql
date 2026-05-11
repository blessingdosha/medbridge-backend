-- Multi-tenant hospital registration, users, and request scoping.
-- Run after base database_schema.sql (see init_db.js or npm run migrate).

ALTER TABLE public.hospitals
  ADD COLUMN IF NOT EXISTS license_number VARCHAR(255),
  ADD COLUMN IF NOT EXISTS registration_status VARCHAR(50) DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITHOUT TIME ZONE;

CREATE UNIQUE INDEX IF NOT EXISTS hospitals_license_number_key
  ON public.hospitals (license_number)
  WHERE license_number IS NOT NULL AND TRIM(license_number) <> '';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS hospital_id INTEGER REFERENCES public.hospitals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS invited_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.equipment_requests
  ADD COLUMN IF NOT EXISTS hospital_id INTEGER REFERENCES public.hospitals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

UPDATE public.hospitals SET registration_status = 'approved' WHERE registration_status IS NULL;
