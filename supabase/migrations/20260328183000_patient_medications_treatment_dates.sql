alter table public.patient_medications
add column start_date date null,
add column next_consultation_at timestamptz null;

update public.patient_medications
set start_date = created_at::date
where start_date is null;

alter table public.patient_medications
alter column start_date set not null;
