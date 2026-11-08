-- Atomically create a new active resume and retire the previous one.
-- Run once in Supabase SQL Editor after the base Signal schema.

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

  insert into public.application_resumes (
    user_id,
    storage_path,
    file_name,
    content_type,
    byte_size,
    is_active
  )
  values (
    auth.uid(),
    p_storage_path,
    p_file_name,
    nullif(trim(p_content_type), ''),
    p_byte_size,
    true
  )
  returning * into next_resume;

  return next_resume;
end;
$$;

revoke all on function public.activate_application_resume(text, text, text, bigint) from public, anon;
grant execute on function public.activate_application_resume(text, text, text, bigint) to authenticated;
