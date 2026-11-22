-- =============================================================================
-- Only Super Admin may call add_sessions_to_patient directly
-- (Admin can still approve patient requests via approve_session_request)
-- Run once in Supabase SQL Editor
-- =============================================================================

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

  if not public.is_super_admin() then
    raise exception 'Only Super Admin can add sessions';
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

-- Approve request: Admin/Super Admin; applies sessions without calling add_sessions_to_patient
create or replace function public.approve_session_request(p_request_id uuid)
returns public.session_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.session_requests;
  v_pkg public.session_packages;
  v_purchase_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

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

  select * into v_pkg
  from public.session_packages
  where id = v_req.package_id and active = true;

  if not found then
    raise exception 'Package not found or inactive';
  end if;

  update public.patients
  set sessions_remaining = sessions_remaining + v_pkg.sessions_count,
      updated_at = now()
  where id = v_req.patient_id;

  insert into public.purchases (patient_id, package_id, sessions_added, amount, created_by)
  values (v_req.patient_id, v_req.package_id, v_pkg.sessions_count, v_pkg.price, auth.uid())
  returning id into v_purchase_id;

  insert into public.payments (patient_id, purchase_id, amount, note, created_by)
  values (
    v_req.patient_id,
    v_purchase_id,
    v_pkg.price,
    'Paid on request approval',
    auth.uid()
  );

  update public.session_requests
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id
  returning * into v_req;

  return v_req;
end;
$$;

grant execute on function public.add_sessions_to_patient(uuid, uuid, numeric) to authenticated;
grant execute on function public.approve_session_request(uuid) to authenticated;

notify pgrst, 'reload schema';
