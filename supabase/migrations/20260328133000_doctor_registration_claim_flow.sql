alter table public.approved_doctors
drop constraint approved_doctors_status_check;

alter table public.approved_doctors
add constraint approved_doctors_status_check
check (status in ('pending', 'approved', 'claimed', 'rejected', 'suspended'));

create or replace function public.claim_approved_doctor_registration(
  p_auth_user_id uuid,
  p_dni text,
  p_email text,
  p_phone text,
  p_type text default 'obra_social'
)
returns table (
  active_doctor_id integer,
  approved_doctor_id integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doctor public.approved_doctors%rowtype;
  v_active_doctor public.active_doctors%rowtype;
  v_dni text := btrim(p_dni);
  v_email text := lower(btrim(p_email));
  v_phone text := btrim(p_phone);
  v_type text := coalesce(nullif(btrim(p_type), ''), 'obra_social');
begin
  if p_auth_user_id is null then
    raise exception 'Missing auth user id'
      using errcode = 'P0001', detail = 'missing_auth_user_id';
  end if;

  select *
  into v_doctor
  from public.approved_doctors
  where dni = v_dni
  for update;

  if not found then
    raise exception 'Doctor not found'
      using errcode = 'P0001', detail = 'dni_not_found';
  end if;

  if v_doctor.claimed_by_auth_user_id is not null or v_doctor.status = 'claimed' then
    raise exception 'Doctor already claimed'
      using errcode = 'P0001', detail = 'doctor_already_claimed';
  end if;

  if v_doctor.status <> 'approved' then
    raise exception 'Doctor not approved'
      using errcode = 'P0001', detail = 'doctor_not_approved';
  end if;

  insert into public.active_doctors (
    auth_user_id,
    approved_doctor_id,
    name,
    dni,
    email,
    phone,
    type,
    organization,
    license_number
  )
  values (
    p_auth_user_id,
    v_doctor.approved_doctor_id,
    v_doctor.full_name,
    v_doctor.dni,
    v_email,
    v_phone,
    v_type,
    v_doctor.organization,
    v_doctor.license_number
  )
  returning *
  into v_active_doctor;

  update public.approved_doctors
  set
    claimed_by_auth_user_id = p_auth_user_id,
    status = 'claimed'
  where approved_doctor_id = v_doctor.approved_doctor_id;

  return query
  select
    v_active_doctor.active_doctor_id,
    v_doctor.approved_doctor_id;
exception
  when unique_violation then
    raise exception 'Doctor registration conflict'
      using errcode = 'P0001', detail = 'doctor_registration_conflict';
end;
$$;

revoke all on function public.claim_approved_doctor_registration(uuid, text, text, text, text) from public;
revoke all on function public.claim_approved_doctor_registration(uuid, text, text, text, text) from anon;
revoke all on function public.claim_approved_doctor_registration(uuid, text, text, text, text) from authenticated;
grant execute on function public.claim_approved_doctor_registration(uuid, text, text, text, text) to service_role;
