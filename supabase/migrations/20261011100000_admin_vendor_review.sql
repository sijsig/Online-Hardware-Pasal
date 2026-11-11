create or replace function public.review_vendor_application(
  p_vendor_id uuid,
  p_decision public.vendor_status,
  p_commission_rate numeric default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.vendor_status;
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if p_decision not in ('active', 'rejected') then
    raise exception 'Choose approve or reject for this application' using errcode = '22023';
  end if;
  if p_decision = 'active' and (p_commission_rate is null or p_commission_rate < 0 or p_commission_rate >= 1) then
    raise exception 'An approval commission rate must be from 0%% up to but not including 100%%' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and p_commission_rate is not null then
    raise exception 'Rejected applications cannot have a commission rate' using errcode = '22023';
  end if;

  select status into v_status
  from public.vendors
  where id = p_vendor_id
  for update;

  if not found then
    raise exception 'Shop application not found' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    raise exception 'This shop application has already been reviewed' using errcode = '22023';
  end if;

  update public.vendors
  set status = p_decision,
      commission_rate = case when p_decision = 'active' then p_commission_rate else null end
  where id = p_vendor_id;
end;
$$;

revoke all on function public.review_vendor_application(uuid, public.vendor_status, numeric) from public, anon;
grant execute on function public.review_vendor_application(uuid, public.vendor_status, numeric) to authenticated;
