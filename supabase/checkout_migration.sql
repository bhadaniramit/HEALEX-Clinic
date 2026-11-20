-- =============================================================================
-- HEALEX — Checkout support (run once in Supabase SQL Editor)
-- Adds checked_out_at + check_out_patient RPC
-- =============================================================================

alter table public.visits
  add column if not exists checked_out_at timestamptz null;

create index if not exists visits_open_today_idx
  on public.visits (created_at desc)
  where checked_out_at is null;

-- Check out the latest open visit for a patient
create or replace function public.check_out_patient(p_patient_id uuid)
returns public.visits
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visit public.visits;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_staff() then
    raise exception 'Only staff can check out patients';
  end if;

  select * into v_visit
  from public.visits
  where patient_id = p_patient_id
    and checked_out_at is null
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Patient is not currently checked in';
  end if;

  update public.visits
  set checked_out_at = now()
  where id = v_visit.id
  returning * into v_visit;

  return v_visit;
end;
$$;

grant execute on function public.check_out_patient(uuid) to authenticated;

notify pgrst, 'reload schema';
