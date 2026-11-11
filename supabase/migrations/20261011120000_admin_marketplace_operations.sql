create or replace function public.admin_set_vendor_status(p_vendor_id uuid, p_status public.vendor_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.vendor_status;
  v_commission_rate numeric;
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'Choose active or suspended' using errcode = '22023';
  end if;
  select status, commission_rate into v_status, v_commission_rate
  from public.vendors where id = p_vendor_id for update;
  if not found then raise exception 'Shop not found' using errcode = 'P0002'; end if;
  if v_status not in ('active', 'suspended') then
    raise exception 'Only approved shops can be changed here' using errcode = '22023';
  end if;
  if p_status = 'active' and v_commission_rate is null then
    raise exception 'Set the shop commission through application review first' using errcode = '22023';
  end if;
  update public.vendors set status = p_status where id = p_vendor_id;
end;
$$;

create or replace function public.admin_set_rider_status(p_rider_id uuid, p_status public.rider_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application_status text;
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_status not in ('offline', 'suspended') then
    raise exception 'Administrators can set riders offline or suspended' using errcode = '22023';
  end if;
  select application_status into v_application_status
  from public.riders where user_id = p_rider_id for update;
  if not found then raise exception 'Rider not found' using errcode = 'P0002'; end if;
  if v_application_status <> 'approved' then
    raise exception 'Only approved riders can be managed here' using errcode = '22023';
  end if;
  if p_status = 'offline' and exists (
    select 1 from public.delivery_assignments
    where rider_id = p_rider_id and status in ('offered', 'accepted', 'picked_up')
  ) then
    raise exception 'A rider with an active delivery cannot be set offline' using errcode = '22023';
  end if;
  update public.riders set status = p_status where user_id = p_rider_id;
end;
$$;

revoke all on function public.admin_set_vendor_status(uuid, public.vendor_status) from public, anon;
revoke all on function public.admin_set_rider_status(uuid, public.rider_status) from public, anon;
grant execute on function public.admin_set_vendor_status(uuid, public.vendor_status),
  public.admin_set_rider_status(uuid, public.rider_status) to authenticated;
