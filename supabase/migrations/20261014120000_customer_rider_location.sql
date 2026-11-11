-- Let order participants read only the current rider position for an active delivery.
-- The riders table stays private; callers cannot look up an arbitrary rider.
create or replace function public.customer_get_order_rider_location(p_order_id uuid)
returns table(latitude double precision, longitude double precision, location_updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not public.can_access_order(p_order_id) then
    raise exception 'Not allowed to view this order delivery' using errcode = '42501';
  end if;

  return query
  select extensions.st_y(r.current_location::extensions.geometry),
         extensions.st_x(r.current_location::extensions.geometry),
         r.location_updated_at
  from public.delivery_assignments da
  join public.riders r on r.user_id = da.rider_id
  where da.order_id = p_order_id
    and da.status in ('accepted', 'picked_up')
    and r.current_location is not null
  order by da.offered_at desc
  limit 1;
end;
$$;

revoke all on function public.customer_get_order_rider_location(uuid) from public, anon;
grant execute on function public.customer_get_order_rider_location(uuid) to authenticated;
