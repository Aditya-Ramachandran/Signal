-- Signal Apply Milestone 4: service-role-only request claiming for the local runner.
-- Run this once in the Supabase SQL Editor after the base Signal Apply schema.

create or replace function public.claim_next_application_request(p_runner_id text)
returns setof public.application_requests
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(trim(p_runner_id), '') = '' then
    raise exception 'Runner id is required';
  end if;

  return query
  with candidate as (
    select id
    from public.application_requests
    where status = 'approved_to_prepare'
      and application_mode = 'agent'
      and application_platform = 'workday'
    order by preparation_approved_at asc nulls last, created_at asc
    for update skip locked
    limit 1
  )
  update public.application_requests request
  set status = 'running', runner_id = trim(p_runner_id), updated_at = now()
  from candidate
  where request.id = candidate.id
  returning request.*;
end;
$$;

revoke all on function public.claim_next_application_request(text) from public, anon, authenticated;
grant execute on function public.claim_next_application_request(text) to service_role;
