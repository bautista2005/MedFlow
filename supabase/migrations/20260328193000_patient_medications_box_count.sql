alter table public.patient_medications
add column box_count integer null;

update public.patient_medications
set box_count = 1
where box_count is null;

alter table public.patient_medications
alter column box_count set not null,
alter column box_count set default 1;

alter table public.patient_medications
add constraint patient_medications_box_count_check
check (box_count > 0);
