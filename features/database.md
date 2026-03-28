Estoy creando MEDIYA desde cero como aplicación web con este stack:

- Next.js + React + TypeScript
- Supabase para auth, base de datos y backend
- Tailwind CSS + shadcn/ui

Quiero generar la migración SQL inicial para estas tablas:

1) approved_doctors
Campos:
- approved_doctor_id primary key
- full_name text not null
- dni text unique not null
- license_number text unique not null
- organization text not null
- specialty text
- status text not null default 'approved'
- claimed_by_auth_user_id uuid unique null
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

2) active_doctors
Campos:
- active_doctor_id primary key
- auth_user_id uuid unique not null references auth.users(id)
- approved_doctor_id integer unique not null references approved_doctors(approved_doctor_id)
- name text not null
- dni text unique not null
- email text unique not null
- phone text not null
- type text not null default 'obra_social'
- organization text not null
- license_number text not null
- is_active boolean not null default true
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

3) patients
Campos:
- patient_id primary key
- auth_user_id uuid unique not null references auth.users(id)
- name text not null
- dni text unique not null
- email text unique not null
- phone text
- address text
- zone text
- preferred_pharmacy_id integer null
- is_active boolean not null default true
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

4) patient_doctors
Campos:
- patient_doctor_id primary key
- patient_id integer not null references patients(patient_id)
- active_doctor_id integer not null references active_doctors(active_doctor_id)
- role text
- is_primary boolean not null default false
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

5) pharmacies
Campos:
- pharmacy_id primary key
- name text not null
- location text
- address text
- zone text
- city text
- whatsapp_number text
- accepts_digital_prescription boolean not null default true
- is_active boolean not null default true
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

Además:
- agregá la foreign key en patients.preferred_pharmacy_id hacia pharmacies(pharmacy_id)
- agregá índices útiles por dni, auth_user_id, status y approved_doctor_id
- agregá restricciones y checks razonables
- hacé todo compatible con PostgreSQL y Supabase
- no agregues tabla organizations; organization debe quedar como text
- generá la migración SQL lista para usar en Supabase