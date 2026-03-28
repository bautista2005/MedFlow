create or replace function public.create_patient_treatment_with_optional_schedule(
  p_patient_id integer,
  p_active_doctor_id integer,
  p_medication_name text,
  p_daily_dose numeric,
  p_interval_hours numeric,
  p_pills_per_box integer,
  p_box_count integer,
  p_start_date date,
  p_schedule_is_enabled boolean default null,
  p_schedule_start_date date default null,
  p_schedule_end_date date default null,
  p_days_of_week smallint[] default null,
  p_intake_slots jsonb default null,
  p_schedule_notes text default null
)
returns table (
  patient_medication_id integer,
  weekly_schedule_config_id integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_medication_id integer;
  v_weekly_schedule_config_id integer := null;
  v_schedule_enabled boolean := coalesce(p_schedule_is_enabled, false);
  v_medication_name text := btrim(p_medication_name);
  v_schedule_notes text := nullif(btrim(coalesce(p_schedule_notes, '')), '');
  v_schedule_start_date date := coalesce(p_schedule_start_date, p_start_date);
  v_intakes_per_day numeric;
  v_units_per_intake numeric;
  v_days_of_week smallint[];
  v_slot_count integer;
begin
  if p_patient_id is null or p_patient_id <= 0 then
    raise exception 'Invalid patient id'
      using errcode = 'P0001', detail = 'invalid_patient_id';
  end if;

  if p_active_doctor_id is null or p_active_doctor_id <= 0 then
    raise exception 'Invalid doctor id'
      using errcode = 'P0001', detail = 'invalid_doctor_id';
  end if;

  if v_medication_name is null or v_medication_name = '' then
    raise exception 'Medication name is required'
      using errcode = 'P0001', detail = 'missing_medication_name';
  end if;

  if p_daily_dose is null or p_daily_dose <= 0 then
    raise exception 'Daily dose must be greater than zero'
      using errcode = 'P0001', detail = 'invalid_daily_dose';
  end if;

  if p_interval_hours is null or p_interval_hours <= 0 then
    raise exception 'Interval hours must be greater than zero'
      using errcode = 'P0001', detail = 'invalid_interval_hours';
  end if;

  if p_pills_per_box is null or p_pills_per_box <= 0 then
    raise exception 'Pills per box must be greater than zero'
      using errcode = 'P0001', detail = 'invalid_pills_per_box';
  end if;

  if p_box_count is null or p_box_count <= 0 then
    raise exception 'Box count must be greater than zero'
      using errcode = 'P0001', detail = 'invalid_box_count';
  end if;

  if p_start_date is null then
    raise exception 'Start date is required'
      using errcode = 'P0001', detail = 'missing_start_date';
  end if;

  perform 1
  from public.patient_doctors as pd
  where pd.patient_id = p_patient_id
    and pd.active_doctor_id = p_active_doctor_id;

  if not found then
    raise exception 'Patient does not belong to doctor'
      using errcode = 'P0001', detail = 'patient_not_linked_to_doctor';
  end if;

  v_intakes_per_day := 24 / p_interval_hours;
  v_units_per_intake := p_daily_dose / v_intakes_per_day;

  if v_schedule_enabled then
    if mod(24, p_interval_hours) <> 0 then
      raise exception 'Weekly schedule requires a whole-number daily frequency'
        using errcode = 'P0001', detail = 'invalid_schedule_interval';
    end if;

    v_days_of_week := coalesce(p_days_of_week, array[]::smallint[]);

    if coalesce(array_length(v_days_of_week, 1), 0) = 0 then
      raise exception 'Weekly schedule requires at least one day'
        using errcode = 'P0001', detail = 'weekly_schedule_days_required';
    end if;

    if exists (
      select 1
      from unnest(v_days_of_week) as schedule_day
      where schedule_day < 0 or schedule_day > 6
    ) then
      raise exception 'Weekly schedule has invalid weekdays'
        using errcode = 'P0001', detail = 'weekly_schedule_invalid_day';
    end if;

    if p_intake_slots is null or jsonb_typeof(p_intake_slots) <> 'array' or p_intake_slots = '[]'::jsonb then
      raise exception 'Weekly schedule requires intake slots'
        using errcode = 'P0001', detail = 'weekly_schedule_slots_required';
    end if;

    select count(*)
    into v_slot_count
    from jsonb_array_elements(p_intake_slots);

    if v_slot_count <> v_intakes_per_day::integer then
      raise exception 'Weekly schedule slot count does not match treatment frequency'
        using errcode = 'P0001', detail = 'weekly_schedule_slots_mismatch';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_intake_slots) as slot
      where coalesce(nullif(btrim(slot ->> 'slot_key'), ''), '') = ''
    ) then
      raise exception 'Weekly schedule slot key is invalid'
        using errcode = 'P0001', detail = 'weekly_schedule_invalid_slot_key';
    end if;

    if exists (
      select 1
      from (
        select btrim(slot ->> 'slot_key') as slot_key, count(*) as total
        from jsonb_array_elements(p_intake_slots) as slot
        group by 1
      ) as duplicated_slots
      where duplicated_slots.total > 1
    ) then
      raise exception 'Weekly schedule slot key is duplicated'
        using errcode = 'P0001', detail = 'weekly_schedule_duplicate_slot_key';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_intake_slots) as slot
      where slot ? 'time'
        and coalesce(slot ->> 'time', '') <> ''
        and not ((slot ->> 'time') ~ '^\d{2}:\d{2}$')
    ) then
      raise exception 'Weekly schedule time format is invalid'
        using errcode = 'P0001', detail = 'weekly_schedule_invalid_time';
    end if;

    if p_schedule_end_date is not null and p_schedule_end_date < v_schedule_start_date then
      raise exception 'Weekly schedule end date cannot be before start date'
        using errcode = 'P0001', detail = 'weekly_schedule_end_before_start';
    end if;
  end if;

  insert into public.patient_medications (
    patient_id,
    active_doctor_id,
    medication_name,
    presentation,
    dose_text,
    frequency_text,
    pills_per_box,
    box_count,
    units_per_intake,
    intakes_per_day,
    start_date,
    next_consultation_at,
    notes,
    is_active
  )
  values (
    p_patient_id,
    p_active_doctor_id,
    v_medication_name,
    null,
    concat(trim(to_char(p_daily_dose, 'FM999999990.##')), ' unidades por dia'),
    concat('Cada ', trim(to_char(p_interval_hours, 'FM999999990.##')), ' hs'),
    p_pills_per_box,
    p_box_count,
    v_units_per_intake,
    v_intakes_per_day,
    p_start_date,
    null,
    null,
    true
  )
  returning public.patient_medications.patient_medication_id
  into v_patient_medication_id;

  if v_schedule_enabled then
    insert into public.weekly_schedule_configs (
      patient_medication_id,
      patient_id,
      active_doctor_id,
      is_enabled,
      schedule_start_date,
      schedule_end_date,
      days_of_week,
      intake_slots,
      notes
    )
    values (
      v_patient_medication_id,
      p_patient_id,
      p_active_doctor_id,
      true,
      v_schedule_start_date,
      p_schedule_end_date,
      v_days_of_week,
      p_intake_slots,
      v_schedule_notes
    )
    returning public.weekly_schedule_configs.weekly_schedule_config_id
    into v_weekly_schedule_config_id;
  end if;

  return query
  select
    v_patient_medication_id as patient_medication_id,
    v_weekly_schedule_config_id as weekly_schedule_config_id;
end;
$$;

revoke all on function public.create_patient_treatment_with_optional_schedule(
  integer,
  integer,
  text,
  numeric,
  numeric,
  integer,
  integer,
  date,
  boolean,
  date,
  date,
  smallint[],
  jsonb,
  text
) from public;
revoke all on function public.create_patient_treatment_with_optional_schedule(
  integer,
  integer,
  text,
  numeric,
  numeric,
  integer,
  integer,
  date,
  boolean,
  date,
  date,
  smallint[],
  jsonb,
  text
) from anon;
revoke all on function public.create_patient_treatment_with_optional_schedule(
  integer,
  integer,
  text,
  numeric,
  numeric,
  integer,
  integer,
  date,
  boolean,
  date,
  date,
  smallint[],
  jsonb,
  text
) from authenticated;
grant execute on function public.create_patient_treatment_with_optional_schedule(
  integer,
  integer,
  text,
  numeric,
  numeric,
  integer,
  integer,
  date,
  boolean,
  date,
  date,
  smallint[],
  jsonb,
  text
) to service_role;
