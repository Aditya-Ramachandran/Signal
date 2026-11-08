-- Signal Apply Milestone 5: a runner heartbeat with no applicant data.
-- Run once in the Supabase SQL Editor after the Signal Apply base schema.

create table if not exists public.application_runner_health (
  runner_id text primary key,
  state text not null check (state in ('online', 'working', 'degraded', 'offline')),
  detail jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.application_runner_health enable row level security;

drop policy if exists "Users can read application runner health" on public.application_runner_health;
create policy "Users can read application runner health"
on public.application_runner_health for select to authenticated using (true);
