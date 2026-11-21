-- =============================================================================
-- Add Diet/Lifestyle recommendation type
-- Run once in Supabase SQL Editor
-- =============================================================================

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'recommendation_type'
      and e.enumlabel = 'diet_lifestyle'
  ) then
    alter type public.recommendation_type add value 'diet_lifestyle';
  end if;
end
$$;

notify pgrst, 'reload schema';
