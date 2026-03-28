alter table public.prescription_requests
drop constraint if exists prescription_requests_status_check;

update public.prescription_requests
set status = 'accepted'
where status = 'uploaded';

alter table public.prescription_requests
add constraint prescription_requests_status_check
check (status in ('pending', 'reviewed', 'accepted', 'rejected', 'cancelled'));
