create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

alter table public.approved_doctors enable row level security;
alter table public.active_doctors enable row level security;
alter table public.patients enable row level security;
alter table public.patient_doctors enable row level security;
alter table public.pharmacies enable row level security;
