-- =============================================================================
-- Payment split: track money collected vs package charges
-- Run once in Supabase SQL Editor
-- =============================================================================

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  purchase_id uuid references public.purchases (id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  note text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists payments_patient_id_idx on public.payments (patient_id);
create index if not exists payments_created_at_idx on public.payments (created_at desc);

alter table public.payments enable row level security;

drop policy if exists "payments_staff_or_own_select" on public.payments;
create policy "payments_staff_or_own_select"
  on public.payments for select
  using (public.is_staff() or patient_id = public.my_patient_id());

drop policy if exists "payments_super_admin_insert" on public.payments;
create policy "payments_super_admin_insert"
  on public.payments for insert
  with check (public.is_super_admin());

-- Existing purchases were treated as fully paid — backfill once
insert into public.payments (patient_id, purchase_id, amount, note, created_by, created_at)
select
  p.patient_id,
  p.id,
  p.amount,
  'Backfill: assumed paid at purchase',
  p.created_by,
  p.created_at
from public.purchases p
where p.amount > 0
  and not exists (
    select 1 from public.payments pay where pay.purchase_id = p.id
  );

-- Totals for a patient
create or replace function public.patient_payment_totals(p_patient_id uuid)
returns table (
  total_charged numeric,
  total_paid numeric,
  balance numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select sum(amount) from public.purchases where patient_id = p_patient_id), 0)::numeric,
    coalesce((select sum(amount) from public.payments where patient_id = p_patient_id), 0)::numeric,
    (
      coalesce((select sum(amount) from public.purchases where patient_id = p_patient_id), 0)
      - coalesce((select sum(amount) from public.payments where patient_id = p_patient_id), 0)
    )::numeric;
$$;

-- Super Admin records a payment (toward balance)
create or replace function public.record_patient_payment(
  p_patient_id uuid,
  p_amount numeric,
  p_note text default null
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
  v_payment public.payments;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_super_admin() then
    raise exception 'Only Super Admin can record split payments';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than 0';
  end if;

  if not exists (select 1 from public.patients where id = p_patient_id) then
    raise exception 'Patient not found';
  end if;

  select balance into v_balance
  from public.patient_payment_totals(p_patient_id);

  if p_amount > v_balance then
    raise exception 'Payment (%) exceeds balance (%)', p_amount, v_balance;
  end if;

  insert into public.payments (patient_id, amount, note, created_by)
  values (p_patient_id, p_amount, nullif(trim(coalesce(p_note, '')), ''), auth.uid())
  returning * into v_payment;

  return v_payment;
end;
$$;

-- Replace older signatures so defaults apply cleanly
drop function if exists public.add_sessions_to_patient(uuid, uuid);
drop function if exists public.add_sessions_to_patient(uuid, uuid, numeric);
drop function if exists public.create_patient_with_package(text, date, text, text, uuid);
drop function if exists public.create_patient_with_package(text, date, text, text, uuid, numeric);

-- Add sessions; optional amount paid now (null = full package price)
create or replace function public.add_sessions_to_patient(
  p_patient_id uuid,
  p_package_id uuid,
  p_amount_paid numeric default null
)
returns public.purchases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pkg public.session_packages;
  v_purchase public.purchases;
  v_paid numeric;
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

  v_paid := coalesce(p_amount_paid, v_pkg.price);

  if v_paid < 0 then
    raise exception 'Amount paid cannot be negative';
  end if;

  if v_paid > v_pkg.price then
    raise exception 'Amount paid cannot exceed package price';
  end if;

  -- Only Super Admin may leave a balance (partial pay)
  if v_paid < v_pkg.price and not public.is_super_admin() then
    raise exception 'Only Super Admin can split payment';
  end if;

  update public.patients
  set sessions_remaining = sessions_remaining + v_pkg.sessions_count,
      updated_at = now()
  where id = p_patient_id;

  insert into public.purchases (patient_id, package_id, sessions_added, amount, created_by)
  values (p_patient_id, p_package_id, v_pkg.sessions_count, v_pkg.price, auth.uid())
  returning * into v_purchase;

  if v_paid > 0 then
    insert into public.payments (patient_id, purchase_id, amount, note, created_by)
    values (
      p_patient_id,
      v_purchase.id,
      v_paid,
      case when v_paid < v_pkg.price then 'Partial payment at purchase' else 'Paid at purchase' end,
      auth.uid()
    );
  end if;

  return v_purchase;
end;
$$;

-- Create patient; optional amount paid now (null = full package price)
create or replace function public.create_patient_with_package(
  p_name text,
  p_dob date,
  p_address text,
  p_phone text,
  p_package_id uuid,
  p_amount_paid numeric default null
)
returns public.patients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pkg public.session_packages;
  v_patient public.patients;
  v_purchase_id uuid;
  v_phone text;
  v_paid numeric;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_admin_or_above() then
    raise exception 'Only admin or super admin can create patients';
  end if;

  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(v_phone) = 12 and left(v_phone, 2) = '91' then
    v_phone := right(v_phone, 10);
  end if;
  if length(v_phone) <> 10 then
    raise exception 'Phone must be a 10-digit mobile number';
  end if;

  if exists (select 1 from public.patients where phone = v_phone) then
    raise exception 'A patient with this phone number already exists';
  end if;

  select * into v_pkg
  from public.session_packages
  where id = p_package_id and active = true;

  if not found then
    raise exception 'Package not found or inactive';
  end if;

  v_paid := coalesce(p_amount_paid, v_pkg.price);

  if v_paid < 0 then
    raise exception 'Amount paid cannot be negative';
  end if;

  if v_paid > v_pkg.price then
    raise exception 'Amount paid cannot exceed package price';
  end if;

  if v_paid < v_pkg.price and not public.is_super_admin() then
    raise exception 'Only Super Admin can split payment';
  end if;

  insert into public.patients (name, dob, address, phone, sessions_remaining, created_by)
  values (p_name, p_dob, coalesce(p_address, ''), v_phone, v_pkg.sessions_count, auth.uid())
  returning * into v_patient;

  insert into public.purchases (patient_id, package_id, sessions_added, amount, created_by)
  values (v_patient.id, p_package_id, v_pkg.sessions_count, v_pkg.price, auth.uid())
  returning id into v_purchase_id;

  if v_paid > 0 then
    insert into public.payments (patient_id, purchase_id, amount, note, created_by)
    values (
      v_patient.id,
      v_purchase_id,
      v_paid,
      case when v_paid < v_pkg.price then 'Partial payment at registration' else 'Paid at registration' end,
      auth.uid()
    );
  end if;

  return v_patient;
end;
$$;

-- Approve still uses add_sessions (full pay by default via null)
-- Overload-safe grants
grant execute on function public.patient_payment_totals(uuid) to authenticated;
grant execute on function public.record_patient_payment(uuid, numeric, text) to authenticated;
grant execute on function public.add_sessions_to_patient(uuid, uuid, numeric) to authenticated;
grant execute on function public.create_patient_with_package(text, date, text, text, uuid, numeric) to authenticated;
-- Keep older 2-arg / 5-arg signatures callable if PostgREST cached them
grant execute on function public.add_sessions_to_patient(uuid, uuid) to authenticated;
grant execute on function public.create_patient_with_package(text, date, text, text, uuid) to authenticated;

notify pgrst, 'reload schema';
