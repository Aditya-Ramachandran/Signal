-- Signal: invite-only accounts and private workspace data
-- Run this file in Supabase Dashboard -> SQL Editor -> New query.

create table if not exists public.allowed_users (
  email text primary key check (email = lower(email)),
  invited_at timestamptz not null default now(),
  note text
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  target_roles text,
  preferred_locations text,
  jobs_feed_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.job_progress (
  user_id uuid references public.profiles(id) on delete cascade,
  job_id text not null,
  status text not null default 'New' check (status in ('New', 'Applied', 'Referred', 'Rejected')),
  saved boolean not null default false,
  snoozed_until date,
  updated_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

alter table public.allowed_users enable row level security;
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.job_progress enable row level security;

create policy "Users can check their own invitation"
on public.allowed_users for select to authenticated
using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "Users can read their own profile"
on public.profiles for select to authenticated using (id = auth.uid());
create policy "Users can update their own profile"
on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "Users can read their own settings"
on public.user_settings for select to authenticated using (user_id = auth.uid());
create policy "Users can create their own settings"
on public.user_settings for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update their own settings"
on public.user_settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users can read their own job progress"
on public.job_progress for select to authenticated using (user_id = auth.uid());
create policy "Users can create their own job progress"
on public.job_progress for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update their own job progress"
on public.job_progress for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can delete their own job progress"
on public.job_progress for delete to authenticated using (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill profiles for people who signed in before the trigger was created.
-- Without this, job_progress writes fail their profiles foreign-key check.
insert into public.profiles (id, email, display_name, avatar_url)
select
  id,
  lower(email),
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'),
  raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do update set
  email = excluded.email,
  display_name = excluded.display_name,
  avatar_url = excluded.avatar_url;

-- Add yourself after running this script. Replace with your Google email:
-- insert into public.allowed_users (email, note) values ('you@example.com', 'Owner');

-- Signal Apply: private, approval-gated application workflow.
-- This is intentionally data-only. A future server-side runner uses a service-role
-- credential kept outside this repository; browser clients never receive that key.

create table if not exists public.application_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  contact jsonb not null default '{}'::jsonb,
  links jsonb not null default '{}'::jsonb,
  experience jsonb not null default '[]'::jsonb,
  education jsonb not null default '[]'::jsonb,
  skills jsonb not null default '[]'::jsonb,
  common_answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.application_resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  content_type text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  sha256 text,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists application_resumes_one_active_per_user
  on public.application_resumes (user_id)
  where is_active;

create or replace function public.activate_application_resume(
  p_storage_path text,
  p_file_name text,
  p_content_type text,
  p_byte_size bigint
)
returns public.application_resumes
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_resume public.application_resumes;
begin
  if auth.uid() is null then
    raise exception 'A signed-in user is required';
  end if;

  if coalesce(trim(p_storage_path), '') = '' or coalesce(trim(p_file_name), '') = '' then
    raise exception 'Resume file details are required';
  end if;

  if split_part(p_storage_path, '/', 1) <> auth.uid()::text then
    raise exception 'Resume storage path must belong to the signed-in user';
  end if;

  update public.application_resumes
  set is_active = false
  where user_id = auth.uid() and is_active = true;

  insert into public.application_resumes (user_id, storage_path, file_name, content_type, byte_size, is_active)
  values (auth.uid(), p_storage_path, p_file_name, nullif(trim(p_content_type), ''), p_byte_size, true)
  returning * into next_resume;

  return next_resume;
end;
$$;

revoke all on function public.activate_application_resume(text, text, text, bigint) from public, anon;
grant execute on function public.activate_application_resume(text, text, text, bigint) to authenticated;

create table if not exists public.application_answer_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  site text not null,
  field_fingerprint text not null,
  field_label text not null,
  approved_value jsonb not null,
  source text not null default 'user' check (source in ('user', 'profile', 'reviewed_ai')),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, site, field_fingerprint)
);

create table if not exists public.application_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id text not null,
  job_snapshot jsonb not null,
  listing_source text not null check (listing_source in ('workday', 'linkedin', 'indeed', 'external')),
  application_platform text not null check (application_platform in ('workday', 'linkedin_easy_apply', 'indeed_apply', 'external')),
  application_mode text not null check (application_mode in ('agent', 'manual_pack')),
  application_url text not null,
  destination_host text,
  status text not null default 'draft' check (status in (
    'draft',
    'approved_to_prepare',
    'waiting_for_runner',
    'running',
    'needs_you',
    'ready_to_submit',
    'submit_approved',
    'submitted',
    'failed',
    'cancelled'
  )),
  resume_id uuid references public.application_resumes(id) on delete set null,
  profile_version integer not null check (profile_version > 0),
  profile_snapshot jsonb not null,
  preparation_approved_at timestamptz,
  submission_approved_at timestamptz,
  submission_approval_expires_at timestamptz,
  runner_id text,
  ai_step_count integer not null default 0 check (ai_step_count >= 0),
  screenshot_count integer not null default 0 check (screenshot_count >= 0),
  estimated_cost_cents integer not null default 0 check (estimated_cost_cents >= 0),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (application_mode = 'agent' and application_platform = 'workday')
    or application_mode = 'manual_pack'
  ),
  check (
    submission_approval_expires_at is null
    or submission_approved_at is not null
  )
);

create index if not exists application_requests_user_status_updated
  on public.application_requests (user_id, status, updated_at desc);

create table if not exists public.application_run_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.application_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists application_run_events_request_created
  on public.application_run_events (request_id, created_at asc);

-- A runner heartbeat exposes operational state only. It never stores profile,
-- application, browser-cookie, or secret data.
create table if not exists public.application_runner_health (
  runner_id text primary key,
  state text not null check (state in ('online', 'working', 'degraded', 'offline')),
  detail jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.application_profiles enable row level security;
alter table public.application_resumes enable row level security;
alter table public.application_answer_memory enable row level security;
alter table public.application_requests enable row level security;
alter table public.application_run_events enable row level security;
alter table public.application_runner_health enable row level security;

create policy "Users can read their own application profile"
on public.application_profiles for select to authenticated using (user_id = auth.uid());
create policy "Users can create their own application profile"
on public.application_profiles for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update their own application profile"
on public.application_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users can read their own resumes"
on public.application_resumes for select to authenticated using (user_id = auth.uid());
create policy "Users can create their own resumes"
on public.application_resumes for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update their own resumes"
on public.application_resumes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can delete their own resumes"
on public.application_resumes for delete to authenticated using (user_id = auth.uid());

create policy "Users can manage their own answer memory"
on public.application_answer_memory for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users can read their own application requests"
on public.application_requests for select to authenticated using (user_id = auth.uid());
create policy "Users can create their own application requests"
on public.application_requests for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update their own application requests"
on public.application_requests for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users can read their own application run events"
on public.application_run_events for select to authenticated using (user_id = auth.uid());
create policy "Users can read application runner health"
on public.application_runner_health for select to authenticated using (true);

create or replace function public.enforce_application_request_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.role() = 'authenticated' then
    if new.user_id <> auth.uid() then
      raise exception 'Application request ownership must match the signed-in user';
    end if;

    if new.status <> 'draft'
      or new.preparation_approved_at is not null
      or new.submission_approved_at is not null
      or new.submission_approval_expires_at is not null
      or new.runner_id is not null
      or new.ai_step_count <> 0
      or new.screenshot_count <> 0
      or new.estimated_cost_cents <> 0
      or new.submitted_at is not null then
      raise exception 'Browser clients can only create a draft application request';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_application_request_created on public.application_requests;
create trigger on_application_request_created
  before insert on public.application_requests
  for each row execute procedure public.enforce_application_request_insert();

create or replace function public.enforce_application_request_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Browser clients may create a draft, approve preparation, or cancel. The
  -- runner and future approval RPCs use a server-side service role for all
  -- execution states so a browser cannot mark itself submitted.
  if auth.role() = 'authenticated' then
    if new.user_id is distinct from old.user_id then
      raise exception 'Application request ownership cannot change';
    end if;

    if not (
      (old.status = 'draft' and new.status in ('draft', 'approved_to_prepare', 'cancelled'))
      or (old.status = 'approved_to_prepare' and new.status = 'cancelled')
    ) then
      raise exception 'This application state can only be changed by Signal Apply';
    end if;

    if new.status = 'approved_to_prepare' and new.preparation_approved_at is null then
      raise exception 'Preparation approval requires a timestamp';
    end if;

    if old.status = 'draft' and new.status = 'draft'
      and new.preparation_approved_at is distinct from old.preparation_approved_at then
      raise exception 'Preparation approval requires the approved_to_prepare state';
    end if;

    if old.status <> 'draft' and (
      new.job_id is distinct from old.job_id
      or new.job_snapshot is distinct from old.job_snapshot
      or new.listing_source is distinct from old.listing_source
      or new.application_platform is distinct from old.application_platform
      or new.application_mode is distinct from old.application_mode
      or new.application_url is distinct from old.application_url
      or new.resume_id is distinct from old.resume_id
      or new.profile_version is distinct from old.profile_version
      or new.profile_snapshot is distinct from old.profile_snapshot
    ) then
      raise exception 'Approved application details are immutable';
    end if;

    if new.runner_id is distinct from old.runner_id
      or new.ai_step_count is distinct from old.ai_step_count
      or new.screenshot_count is distinct from old.screenshot_count
      or new.estimated_cost_cents is distinct from old.estimated_cost_cents
      or new.submitted_at is distinct from old.submitted_at
      or new.submission_approved_at is distinct from old.submission_approved_at
      or new.submission_approval_expires_at is distinct from old.submission_approval_expires_at then
      raise exception 'Runner and submission fields can only be changed by Signal Apply';
    end if;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_application_request_updated on public.application_requests;
create trigger on_application_request_updated
  before update on public.application_requests
  for each row execute procedure public.enforce_application_request_update();

-- Runner-only RPCs. These functions are intentionally unavailable to browser
-- clients: the local runner connects with the service-role key kept in its own
-- environment, never in Signal's public frontend.
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

insert into storage.buckets (id, name, public)
values ('application-resumes', 'application-resumes', false)
on conflict (id) do update set public = false;

create policy "Users can read their own resume files"
on storage.objects for select to authenticated
using (bucket_id = 'application-resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can upload their own resume files"
on storage.objects for insert to authenticated
with check (bucket_id = 'application-resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can update their own resume files"
on storage.objects for update to authenticated
using (bucket_id = 'application-resumes' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'application-resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete their own resume files"
on storage.objects for delete to authenticated
using (bucket_id = 'application-resumes' and (storage.foldername(name))[1] = auth.uid()::text);
