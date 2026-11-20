-- =============================================================================
-- HEALEX — Allow only ONE check-in per patient per calendar day (IST)
-- Run once in Supabase SQL Editor
-- =============================================================================

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

  -- Block second check-in same IST day
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

grant execute on function public.check_in_patient(uuid, text) to authenticated;

notify pgrst, 'reload schema';
