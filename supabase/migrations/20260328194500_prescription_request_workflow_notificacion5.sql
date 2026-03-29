alter table public.prescription_requests
add column if not exists assigned_pharmacy_id integer null references public.pharmacies (pharmacy_id) on delete set null;

alter table public.prescription_requests
drop constraint if exists prescription_requests_status_check;

update public.prescription_requests
set assigned_pharmacy_id = coalesce(assigned_pharmacy_id, preferred_pharmacy_id);

update public.prescription_requests
set status = 'ready_for_pickup'
where status = 'accepted';

update public.prescription_requests
set status = 'awaiting_alternative_pharmacy'
where status = 'rejected';

alter table public.prescription_requests
add constraint prescription_requests_status_check
check (
  status in (
    'pending',
    'reviewed',
    'prescription_uploaded',
    'pharmacy_checking',
    'no_stock_preferred',
    'awaiting_alternative_pharmacy',
    'ready_for_pickup',
    'cancelled'
  )
);

create index if not exists prescription_requests_assigned_pharmacy_id_idx
  on public.prescription_requests (assigned_pharmacy_id);
