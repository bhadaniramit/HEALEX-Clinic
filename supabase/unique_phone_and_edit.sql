-- =============================================================================
-- HEALEX — Unique phone numbers + keep update for Super Admin / Admin
-- Run once in Supabase SQL Editor
-- =============================================================================

-- Fail clearly if duplicates already exist (fix them in Table Editor first)
do $$
declare
  dup_count integer;
begin
  select count(*) into dup_count
  from (
    select phone
    from public.patients
    group by phone
    having count(*) > 1
  ) d;

  if dup_count > 0 then
    raise exception
      'Cannot add unique phone: % duplicate phone value(s) exist. Fix duplicates in patients table first.',
      dup_count;
  end if;
end $$;

create unique index if not exists patients_phone_unique
  on public.patients (phone);

-- Friendlier create when phone already exists
create or replace function public.create_patient_with_package(
  p_name text,
  p_dob date,
  p_address text,
  p_phone text,
  p_package_id uuid
)
returns public.patients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pkg public.session_packages;
  v_patient public.patients;
  v_phone text := trim(p_phone);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_admin_or_above() then
    raise exception 'Only admin or super admin can create patients';
  end if;

  if v_phone = '' then
    raise exception 'Phone number is required';
  end if;

  if exists (select 1 from public.patients where phone = v_phone) then
    raise exception 'Phone number already exists';
  end if;

  select * into v_pkg
  from public.session_packages
  where id = p_package_id and active = true;

  if not found then
    raise exception 'Package not found or inactive';
  end if;

  insert into public.patients (name, dob, address, phone, sessions_remaining, created_by)
  values (trim(p_name), p_dob, coalesce(trim(p_address), ''), v_phone, v_pkg.sessions_count, auth.uid())
  returning * into v_patient;

  insert into public.purchases (patient_id, package_id, sessions_added, amount, created_by)
  values (v_patient.id, p_package_id, v_pkg.sessions_count, v_pkg.price, auth.uid());

  return v_patient;
end;
$$;

-- Update patient demographics (Super Admin / Admin)
create or replace function public.update_patient_details(
  p_patient_id uuid,
  p_name text,
  p_dob date,
  p_address text,
  p_phone text
)
returns public.patients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient public.patients;
  v_phone text := trim(p_phone);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Product requirement: Super Admin edits; Admin also allowed (clinic ops)
  if not public.is_admin_or_above() then
    raise exception 'Only super admin or admin can edit patient details';
  end if;

  if v_phone = '' then
    raise exception 'Phone number is required';
  end if;

  if exists (
    select 1 from public.patients
    where phone = v_phone and id <> p_patient_id
  ) then
    raise exception 'Phone number already exists';
  end if;

  update public.patients
  set
    name = trim(p_name),
    dob = p_dob,
    address = coalesce(trim(p_address), ''),
    phone = v_phone,
    updated_at = now()
  where id = p_patient_id
  returning * into v_patient;

  if not found then
    raise exception 'Patient not found';
  end if;

  return v_patient;
end;
$$;

grant execute on function public.create_patient_with_package(text, date, text, text, uuid) to authenticated;
grant execute on function public.update_patient_details(uuid, text, date, text, text) to authenticated;

notify pgrst, 'reload schema';
