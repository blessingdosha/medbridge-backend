-- Patient records and cross-hospital sharing (run after tenancy_migration.sql).

CREATE TABLE IF NOT EXISTS public.patients (
  id SERIAL PRIMARY KEY,
  hospital_id INTEGER NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  created_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  external_reference VARCHAR(255),
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(32),
  phone VARCHAR(64),
  clinical_summary TEXT,
  attachment_path TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patients_hospital_id ON public.patients (hospital_id);

CREATE TABLE IF NOT EXISTS public.patient_shares (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  from_hospital_id INTEGER NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  to_hospital_id INTEGER NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  sender_notes TEXT,
  response_notes TEXT,
  created_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP WITHOUT TIME ZONE,
  CONSTRAINT patient_shares_status_chk CHECK (status IN ('pending', 'accepted', 'declined'))
);

CREATE INDEX IF NOT EXISTS idx_patient_shares_to_status ON public.patient_shares (to_hospital_id, status);
CREATE INDEX IF NOT EXISTS idx_patient_shares_patient ON public.patient_shares (patient_id);
