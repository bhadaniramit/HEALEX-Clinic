-- =============================================================================
-- Patients do NOT use profiles. Identity = 10-digit phone on patients table.
-- Auth email format: {phone}@patients.healex.local
-- Run once in Supabase SQL Editor
-- =============================================================================

create or replace function public.my_patient_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.patients p
  where p.phone = split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)
  limit 1;
$$;

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    case
      when coalesce(auth.jwt() ->> 'email', '') like '%@patients.healex.local'
        then 'patient'::public.user_role
      else null
    end
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('super_admin', 'admin', 'general') from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.my_patient_id() to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_staff() to authenticated;

notify pgrst, 'reload schema';
