-- =============================================================================
-- Patient session request approval: charge package to Balance only
-- (do NOT record payment / Total Paid). Admin + Super Admin.
-- Run once in Supabase SQL Editor
-- =============================================================================

create or replace function public.approve_session_request(p_request_id uuid)
returns public.session_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.session_requests;
  v_pkg public.session_packages;
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

  -- Add sessions
  update public.patients
  set sessions_remaining = sessions_remaining + v_pkg.sessions_count,
      updated_at = now()
  where id = v_req.patient_id;

  -- Charge only (increases Total Charged / Balance). No payment row.
  insert into public.purchases (patient_id, package_id, sessions_added, amount, created_by)
  values (v_req.patient_id, v_req.package_id, v_pkg.sessions_count, v_pkg.price, auth.uid());

  update public.session_requests
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id
  returning * into v_req;

  return v_req;
end;
$$;

grant execute on function public.approve_session_request(uuid) to authenticated;

notify pgrst, 'reload schema';
