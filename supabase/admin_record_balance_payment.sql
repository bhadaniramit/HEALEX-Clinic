-- =============================================================================
-- Allow Admin + Super Admin to record balance payments (accept outstanding balance)
-- Run once in Supabase SQL Editor
-- =============================================================================

drop policy if exists "payments_super_admin_insert" on public.payments;
drop policy if exists "payments_admin_insert" on public.payments;
create policy "payments_admin_insert"
  on public.payments for insert
  with check (public.is_admin_or_above());

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

  if not public.is_admin_or_above() then
    raise exception 'Only Admin or Super Admin can record balance payments';
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

grant execute on function public.record_patient_payment(uuid, numeric, text) to authenticated;

notify pgrst, 'reload schema';
