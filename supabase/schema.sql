-- =============================================================================
-- Bhaiya Clinic — Phase 2 + Phase 3
-- Run once in Supabase → SQL Editor → New query → Run
-- Project: https://vnwyvoiphggzdhehypqa.supabase.co
-- =============================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum (
    'super_admin',
    'admin',
    'general',
    'patient'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.recommendation_type as enum ('medicine', 'exercise');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.request_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- Staff / patient login profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.user_role not null default 'general',
  patient_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.session_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sessions_count integer not null check (sessions_count > 0),
  price numeric(12, 2) not null check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dob date not null,
  address text not null default '',
  phone text not null,
  sessions_remaining integer not null default 0 check (sessions_remaining >= 0),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists patients_phone_unique on public.patients (phone);

-- Link profiles.patient_id after patients exists
do $$ begin
  alter table public.profiles
    add constraint profiles_patient_id_fkey
    foreign key (patient_id) references public.patients (id) on delete set null;
exception when duplicate_object then null;
end $$;

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  checked_in_by uuid references auth.users (id),
  note text,
  created_at timestamptz not null default now(),
  checked_out_at timestamptz null
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  package_id uuid not null references public.session_packages (id),
  sessions_added integer not null check (sessions_added > 0),
  amount numeric(12, 2) not null check (amount >= 0),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.session_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  package_id uuid not null references public.session_packages (id),
  status public.request_status not null default 'pending',
  requested_by uuid references auth.users (id),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  type public.recommendation_type not null,
  content text not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indexes (search must not load all patients)
-- -----------------------------------------------------------------------------
create index if not exists patients_phone_idx on public.patients (phone);
create index if not exists patients_name_idx on public.patients (name);
create index if not exists patients_name_lower_idx on public.patients (lower(name));
create index if not exists visits_patient_id_idx on public.visits (patient_id);
create index if not exists purchases_patient_id_idx on public.purchases (patient_id);
create index if not exists session_requests_patient_id_idx on public.session_requests (patient_id);
create index if not exists session_requests_status_idx on public.session_requests (status);
create index if not exists recommendations_patient_id_idx on public.recommendations (patient_id);
create index if not exists profiles_patient_id_idx on public.profiles (patient_id);

-- -----------------------------------------------------------------------------
-- Seed packages (edit prices anytime in Table Editor)
-- -----------------------------------------------------------------------------
insert into public.session_packages (name, sessions_count, price, active)
select * from (values
  ('5 Sessions', 5, 2500.00, true),
  ('10 Sessions', 10, 4500.00, true),
  ('20 Sessions', 20, 8000.00, true)
) as v(name, sessions_count, price, active)
where not exists (select 1 from public.session_packages limit 1);

-- -----------------------------------------------------------------------------
-- Helper functions for RLS
-- -----------------------------------------------------------------------------
create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
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

create or replace function public.is_admin_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('super_admin', 'admin') from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'super_admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.my_patient_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select patient_id from public.profiles where id = auth.uid();
$$;

-- Auto-create profile when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'general')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- RPCs (business rules — prefer these over raw table writes)
-- -----------------------------------------------------------------------------

-- Check-in: decrement sessions by 1 if > 0
create or replace function public.check_in_patient(p_patient_id uuid, p_note text default null)
returns public.visits
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
  v_visit public.visits;
  v_today_ist date := (timezone('Asia/Kolkata', now()))::date;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_staff() then
    raise exception 'Only staff can check in patients';
  end if;

  if exists (
    select 1
    from public.visits v
    where v.patient_id = p_patient_id
      and (timezone('Asia/Kolkata', v.created_at))::date = v_today_ist
  ) then
    raise exception 'Patient already checked in today';
  end if;

  select sessions_remaining into v_remaining
  from public.patients
  where id = p_patient_id
  for update;

  if not found then
    raise exception 'Patient not found';
  end if;

  if v_remaining <= 0 then
    raise exception 'No sessions remaining';
  end if;

  update public.patients
  set sessions_remaining = sessions_remaining - 1,
      updated_at = now()
  where id = p_patient_id;

  insert into public.visits (patient_id, checked_in_by, note)
  values (p_patient_id, auth.uid(), p_note)
  returning * into v_visit;

  return v_visit;
end;
$$;

-- Add sessions from a package (Admin / Super Admin)
create or replace function public.add_sessions_to_patient(p_patient_id uuid, p_package_id uuid)
returns public.purchases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pkg public.session_packages;
  v_purchase public.purchases;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_admin_or_above() then
    raise exception 'Only admin or super admin can add sessions';
  end if;

  select * into v_pkg
  from public.session_packages
  where id = p_package_id and active = true;

  if not found then
    raise exception 'Package not found or inactive';
  end if;

  if not exists (select 1 from public.patients where id = p_patient_id) then
    raise exception 'Patient not found';
  end if;

  update public.patients
  set sessions_remaining = sessions_remaining + v_pkg.sessions_count,
      updated_at = now()
  where id = p_patient_id;

  insert into public.purchases (patient_id, package_id, sessions_added, amount, created_by)
  values (p_patient_id, p_package_id, v_pkg.sessions_count, v_pkg.price, auth.uid())
  returning * into v_purchase;

  return v_purchase;
end;
$$;

-- Create patient + first package purchase (Admin / Super Admin)
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
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_admin_or_above() then
    raise exception 'Only admin or super admin can create patients';
  end if;

  select * into v_pkg
  from public.session_packages
  where id = p_package_id and active = true;

  if not found then
    raise exception 'Package not found or inactive';
  end if;

  insert into public.patients (name, dob, address, phone, sessions_remaining, created_by)
  values (p_name, p_dob, coalesce(p_address, ''), p_phone, v_pkg.sessions_count, auth.uid())
  returning * into v_patient;

  insert into public.purchases (patient_id, package_id, sessions_added, amount, created_by)
  values (v_patient.id, p_package_id, v_pkg.sessions_count, v_pkg.price, auth.uid());

  return v_patient;
end;
$$;

-- Patient requests more sessions
create or replace function public.request_more_sessions(p_package_id uuid)
returns public.session_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_req public.session_requests;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_patient_id := public.my_patient_id();
  if v_patient_id is null then
    raise exception 'No patient linked to this account';
  end if;

  if not exists (
    select 1 from public.session_packages where id = p_package_id and active = true
  ) then
    raise exception 'Package not found or inactive';
  end if;

  insert into public.session_requests (patient_id, package_id, status, requested_by)
  values (v_patient_id, p_package_id, 'pending', auth.uid())
  returning * into v_req;

  return v_req;
end;
$$;

-- Approve session request
create or replace function public.approve_session_request(p_request_id uuid)
returns public.session_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.session_requests;
begin
  if not public.is_admin_or_above() then
    raise exception 'Only admin or super admin can approve requests';
  end if;

  select * into v_req
  from public.session_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_req.status <> 'pending' then
    raise exception 'Request is not pending';
  end if;

  perform public.add_sessions_to_patient(v_req.patient_id, v_req.package_id);

  update public.session_requests
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id
  returning * into v_req;

  return v_req;
end;
$$;

-- Reject session request
create or replace function public.reject_session_request(p_request_id uuid)
returns public.session_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.session_requests;
begin
  if not public.is_admin_or_above() then
    raise exception 'Only admin or super admin can reject requests';
  end if;

  update public.session_requests
  set status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id and status = 'pending'
  returning * into v_req;

  if not found then
    raise exception 'Pending request not found';
  end if;

  return v_req;
end;
$$;

-- Search patients (staff only) — never returns full table dump without a query
create or replace function public.search_patients(p_query text, p_limit integer default 25)
returns setof public.patients
language plpgsql
security definer
set search_path = public
as $$
declare
  q text := trim(coalesce(p_query, ''));
  lim integer := least(greatest(coalesce(p_limit, 25), 1), 50);
begin
  if not public.is_staff() then
    raise exception 'Only staff can search patients';
  end if;

  if length(q) < 2 then
    return;
  end if;

  return query
  select p.*
  from public.patients p
  where p.phone ilike '%' || q || '%'
     or p.name ilike '%' || q || '%'
  order by p.name
  limit lim;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.session_packages enable row level security;
alter table public.patients enable row level security;
alter table public.visits enable row level security;
alter table public.purchases enable row level security;
alter table public.session_requests enable row level security;
alter table public.recommendations enable row level security;

-- Drop old policies if re-running
do $$ declare r record;
begin
  for r in
    select policyname, tablename from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- profiles
create policy "profiles_select_own_or_staff"
  on public.profiles for select
  using (id = auth.uid() or public.is_staff());

create policy "profiles_update_own_name"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_super_admin_update_all"
  on public.profiles for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- session_packages
create policy "packages_select_authenticated"
  on public.session_packages for select
  to authenticated
  using (active = true or public.is_admin_or_above());

create policy "packages_admin_write"
  on public.session_packages for all
  using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

-- patients
create policy "patients_staff_select"
  on public.patients for select
  using (public.is_staff() or id = public.my_patient_id());

create policy "patients_admin_insert"
  on public.patients for insert
  with check (public.is_admin_or_above());

create policy "patients_admin_update"
  on public.patients for update
  using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

-- visits
create policy "visits_staff_or_own_select"
  on public.visits for select
  using (public.is_staff() or patient_id = public.my_patient_id());

create policy "visits_staff_insert"
  on public.visits for insert
  with check (public.is_staff());

-- purchases
create policy "purchases_staff_or_own_select"
  on public.purchases for select
  using (public.is_staff() or patient_id = public.my_patient_id());

create policy "purchases_admin_insert"
  on public.purchases for insert
  with check (public.is_admin_or_above());

-- session_requests
create policy "session_requests_select"
  on public.session_requests for select
  using (public.is_admin_or_above() or patient_id = public.my_patient_id());

create policy "session_requests_patient_insert"
  on public.session_requests for insert
  with check (patient_id = public.my_patient_id());

create policy "session_requests_admin_update"
  on public.session_requests for update
  using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

-- recommendations
create policy "recommendations_select"
  on public.recommendations for select
  using (public.is_staff() or patient_id = public.my_patient_id());

create policy "recommendations_super_admin_insert"
  on public.recommendations for insert
  with check (public.is_super_admin());

create policy "recommendations_super_admin_update"
  on public.recommendations for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "recommendations_super_admin_delete"
  on public.recommendations for delete
  using (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- Grants for RPCs
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant execute on function public.check_in_patient(uuid, text) to authenticated;
grant execute on function public.add_sessions_to_patient(uuid, uuid) to authenticated;
grant execute on function public.create_patient_with_package(text, date, text, text, uuid) to authenticated;
grant execute on function public.request_more_sessions(uuid) to authenticated;
grant execute on function public.approve_session_request(uuid) to authenticated;
grant execute on function public.reject_session_request(uuid) to authenticated;
grant execute on function public.search_patients(text, integer) to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin_or_above() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.my_patient_id() to authenticated;

-- Done
notify pgrst, 'reload schema';
