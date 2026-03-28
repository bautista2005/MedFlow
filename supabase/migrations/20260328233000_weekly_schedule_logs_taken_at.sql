alter table public.weekly_schedule_logs
add column taken_at timestamptz null;

alter table public.weekly_schedule_logs
add constraint weekly_schedule_logs_taken_at_consistency
check (
  (status = 'missed' and taken_at is null)
  or (status in ('taken', 'taken_late'))
);
