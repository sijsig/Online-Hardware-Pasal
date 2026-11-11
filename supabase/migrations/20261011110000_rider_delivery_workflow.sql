-- Add rider applications and a database-enforced MVP dispatch lifecycle.
-- Existing rider records are considered approved; new applications must be reviewed.
alter table public.riders
  add column application_status text not null default 'approved'
    check (application_status in ('pending', 'approved', 'rejected'));
alter table public.riders alter column application_status set default 'pending';
alter table public.payments
  add column cash_collected_by uuid references public.profiles(id) on delete restrict,
  add column cash_collected_at timestamptz,
  add constraint payments_cash_collection_pair check ((cash_collected_by is null) = (cash_collected_at is null));

create index riders_dispatch_candidates_idx
  on public.riders(status, application_status, location_updated_at)
  where current_location is not null;

create or replace function public.apply_for_rider(p_vehicle_type text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_vehicle text := lower(trim(p_vehicle_type));
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if v_vehicle not in ('bicycle', 'motorcycle', 'scooter', 'car', 'other') then
    raise exception 'Choose a supported vehicle type' using errcode = '22023';
  end if;
  insert into public.riders(user_id, vehicle_type, status, application_status)
  values (v_actor, v_vehicle, 'offline', 'pending')
  on conflict (user_id) do update
    set vehicle_type = excluded.vehicle_type,
        application_status = 'pending',
        status = 'offline'
    where public.riders.application_status = 'rejected';
  if not found then
    raise exception 'A rider application already exists for this account' using errcode = '23505';
  end if;
end;
$$;

create or replace function public.review_rider_application(p_rider_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Choose approve or reject for this application' using errcode = '22023';
  end if;
  select application_status into v_status
  from public.riders where user_id = p_rider_id for update;
  if not found then
    raise exception 'Rider application not found' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    raise exception 'This rider application has already been reviewed' using errcode = '22023';
  end if;
  update public.riders
  set application_status = p_decision, status = 'offline'
  where user_id = p_rider_id;
end;
$$;

create or replace function public.rider_set_availability(p_available boolean)
returns public.rider_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_status public.rider_status;
  v_order_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select status into v_status from public.riders
  where user_id = v_actor and application_status = 'approved' and status <> 'suspended'
  for update;
  if not found then
    raise exception 'An approved rider account is required' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.delivery_assignments
    where rider_id = v_actor and status in ('offered', 'accepted', 'picked_up')
  ) then
    raise exception 'Complete or decline the active delivery before changing availability' using errcode = '22023';
  end if;
  update public.riders set status = case when p_available then 'available'::public.rider_status else 'offline'::public.rider_status end
  where user_id = v_actor;
  if p_available then
    for v_order_id in
      select o.id from public.orders o
      where o.status = 'confirmed'
        and not exists (
          select 1 from public.delivery_assignments da
          where da.order_id = o.id and da.status in ('offered', 'accepted', 'picked_up')
        )
      order by o.created_at
      limit 20
    loop
      perform public.dispatch_order_to_nearest_rider(v_order_id);
    end loop;
  end if;
  return case when p_available then 'available'::public.rider_status else 'offline'::public.rider_status end;
end;
$$;

create or replace function public.rider_update_location(
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_location extensions.geography(Point, 4326);
  v_last_recorded timestamptz;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_latitude is null or p_latitude < 26 or p_latitude > 31 or p_longitude is null or p_longitude < 80 or p_longitude > 89
     or p_accuracy_meters < 0 then
    raise exception 'Choose a valid location in Nepal' using errcode = '22023';
  end if;
  v_location := extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography;
  select recorded_at into v_last_recorded
  from public.rider_location_history
  where rider_id = v_actor order by recorded_at desc limit 1;
  update public.riders
  set current_location = v_location, location_updated_at = clock_timestamp()
  where user_id = v_actor and application_status = 'approved' and status in ('available', 'busy');
  if not found then
    raise exception 'Go available before sharing your location' using errcode = '42501';
  end if;
  if v_last_recorded is null or v_last_recorded < clock_timestamp() - interval '60 seconds' then
    insert into public.rider_location_history(rider_id, location, accuracy_meters)
    values (v_actor, v_location, p_accuracy_meters);
  end if;
end;
$$;

create or replace function public.dispatch_order_to_nearest_rider(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_rider record;
  v_assignment_id uuid;
begin
  select o.id, o.status, v.location as vendor_location
  into v_order
  from public.orders o join public.vendors v on v.id = o.vendor_id
  where o.id = p_order_id for update of o;
  if not found or v_order.status <> 'confirmed' then return null; end if;
  if exists (select 1 from public.delivery_assignments where order_id = p_order_id and status in ('offered', 'accepted', 'picked_up')) then
    return null;
  end if;
  if v_order.vendor_location is null then return null; end if;

  select r.user_id,
         extensions.st_distance(r.current_location, v_order.vendor_location) as distance_meters
  into v_rider
  from public.riders r
  where r.application_status = 'approved'
    and r.status = 'available'
    and r.current_location is not null
    and r.location_updated_at > clock_timestamp() - interval '3 minutes'
    and extensions.st_dwithin(r.current_location, v_order.vendor_location, 15000)
    and not exists (
      select 1 from public.delivery_assignments previous
      where previous.order_id = p_order_id and previous.rider_id = r.user_id
    )
  order by extensions.st_distance(r.current_location, v_order.vendor_location), r.user_id
  limit 1
  for update of r skip locked;
  if not found then return null; end if;

  update public.riders set status = 'busy' where user_id = v_rider.user_id and status = 'available';
  if not found then return null; end if;
  insert into public.delivery_assignments(order_id, rider_id, status, distance_to_vendor_meters)
  values (p_order_id, v_rider.user_id, 'offered', v_rider.distance_meters)
  returning id into v_assignment_id;
  return v_assignment_id;
end;
$$;

create or replace function public.dispatch_confirmed_order(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return public.dispatch_order_to_nearest_rider(p_order_id);
end;
$$;

create or replace function public.dispatch_confirmed_order_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.dispatch_order_to_nearest_rider(new.id);
  return new;
end;
$$;
create trigger orders_dispatch_after_confirmation
after update of status on public.orders
for each row when (new.status = 'confirmed' and old.status is distinct from new.status)
execute function public.dispatch_confirmed_order_trigger();

create or replace function public.rider_accept_assignment(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  perform 1 from public.riders where user_id = v_actor and application_status = 'approved' and status = 'busy' for update;
  if not found then raise exception 'Approved rider account required' using errcode = '42501'; end if;
  update public.delivery_assignments
  set status = 'accepted', accepted_at = clock_timestamp()
  where id = p_assignment_id and rider_id = v_actor and status = 'offered';
  if not found then raise exception 'This delivery offer is no longer available' using errcode = '22023'; end if;
end;
$$;

create or replace function public.rider_decline_assignment(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_order_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  update public.delivery_assignments
  set status = 'declined'
  where id = p_assignment_id and rider_id = v_actor and status = 'offered'
  returning order_id into v_order_id;
  if not found then raise exception 'This delivery offer is no longer available' using errcode = '22023'; end if;
  update public.riders set status = 'available'
  where user_id = v_actor and application_status = 'approved' and status = 'busy';
  perform public.dispatch_order_to_nearest_rider(v_order_id);
end;
$$;

create or replace function public.rider_update_delivery(p_assignment_id uuid, p_action text, p_cash_collected boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_assignment public.delivery_assignments%rowtype;
  v_order public.orders%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_action not in ('pickup', 'deliver') then raise exception 'Choose pickup or deliver' using errcode = '22023'; end if;
  select * into v_assignment from public.delivery_assignments
  where id = p_assignment_id and rider_id = v_actor for update;
  if not found then raise exception 'Delivery assignment not found' using errcode = 'P0002'; end if;
  select * into v_order from public.orders where id = v_assignment.order_id for update;
  if p_action = 'pickup' then
    if v_assignment.status <> 'accepted' or v_order.status <> 'ready_for_pickup' then
      raise exception 'The shop must mark this order ready before pickup' using errcode = '22023';
    end if;
    update public.orders set status = 'picked_up' where id = v_order.id;
    update public.delivery_assignments set status = 'picked_up', picked_up_at = clock_timestamp() where id = p_assignment_id;
  else
    if v_assignment.status <> 'picked_up' or v_order.status <> 'picked_up' then
      raise exception 'Confirm pickup before completing delivery' using errcode = '22023';
    end if;
    if not p_cash_collected then
      raise exception 'Confirm that you collected the cash payment before completing delivery' using errcode = '22023';
    end if;
    update public.orders set status = 'out_for_delivery' where id = v_order.id;
    update public.orders set status = 'delivered' where id = v_order.id;
    update public.payments
    set status = 'paid', cash_collected_by = v_actor, cash_collected_at = clock_timestamp()
    where order_id = v_order.id and method = 'cash_on_delivery' and status = 'pending';
    if not found then
      raise exception 'The cash-on-delivery payment record is unavailable; contact marketplace support' using errcode = 'P0001';
    end if;
    update public.orders set payment_status = 'paid' where id = v_order.id;
    update public.delivery_assignments set status = 'delivered', delivered_at = clock_timestamp() where id = p_assignment_id;
    update public.riders set status = case when status = 'suspended' then status else 'available' end where user_id = v_actor;
  end if;
end;
$$;

create or replace function public.rider_get_my_deliveries()
returns table (
  assignment_id uuid,
  order_id uuid,
  assignment_status public.assignment_status,
  order_status public.order_status,
  total numeric,
  created_at timestamptz,
  customer_snapshot jsonb,
  items_snapshot jsonb,
  shop_snapshot jsonb,
  distance_to_vendor_meters double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select da.id, o.id, da.status, o.status, o.total, o.created_at,
         o.delivery_address_snapshot,
         (select coalesce(jsonb_agg(jsonb_build_object(
           'name', oi.product_name_snapshot, 'quantity', oi.quantity, 'unit', oi.unit_snapshot
         ) order by oi.created_at), '[]'::jsonb) from public.order_items oi where oi.order_id = o.id),
         jsonb_build_object(
           'name', v.name, 'phone', v.phone, 'address_line', v.address_line,
           'city', v.city,
           'latitude', extensions.st_y(v.location::extensions.geometry),
           'longitude', extensions.st_x(v.location::extensions.geometry)
         ),
         da.distance_to_vendor_meters
  from public.delivery_assignments da
  join public.orders o on o.id = da.order_id
  join public.vendors v on v.id = o.vendor_id
  where da.rider_id = (select auth.uid())
    and (da.status in ('offered', 'accepted', 'picked_up') or da.status = 'delivered')
  order by case when da.status in ('offered', 'accepted', 'picked_up') then 0 else 1 end,
           da.offered_at desc
  limit 50;
$$;

revoke all on function public.apply_for_rider(text) from public, anon;
revoke all on function public.review_rider_application(uuid, text) from public, anon;
revoke all on function public.rider_set_availability(boolean) from public, anon;
revoke all on function public.rider_update_location(double precision, double precision, double precision) from public, anon;
revoke all on function public.dispatch_order_to_nearest_rider(uuid) from public, anon, authenticated;
revoke all on function public.dispatch_confirmed_order(uuid) from public, anon;
revoke all on function public.dispatch_confirmed_order_trigger() from public, anon, authenticated;
revoke all on function public.rider_accept_assignment(uuid) from public, anon;
revoke all on function public.rider_decline_assignment(uuid) from public, anon;
revoke all on function public.rider_update_delivery(uuid, text, boolean) from public, anon;
revoke all on function public.rider_get_my_deliveries() from public, anon;
grant execute on function public.apply_for_rider(text), public.review_rider_application(uuid, text),
  public.rider_set_availability(boolean), public.rider_update_location(double precision, double precision, double precision),
  public.dispatch_confirmed_order(uuid), public.rider_accept_assignment(uuid), public.rider_decline_assignment(uuid),
  public.rider_update_delivery(uuid, text, boolean), public.rider_get_my_deliveries() to authenticated;
