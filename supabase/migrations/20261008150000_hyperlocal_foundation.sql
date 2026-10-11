-- Phase 1 database foundation for Hardware Online Pasal.
-- The linked project had no public application tables or applied migrations
-- when this baseline was prepared. This file is local until explicitly pushed.

create extension if not exists postgis with schema extensions;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

create type public.app_role as enum ('customer', 'vendor_owner', 'vendor_staff', 'rider', 'admin');
create type public.vendor_status as enum ('pending', 'active', 'suspended', 'rejected');
create type public.rider_status as enum ('offline', 'available', 'busy', 'suspended');
create type public.order_status as enum (
  'pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up',
  'out_for_delivery', 'delivered', 'cancelled', 'rejected'
);
create type public.payment_method as enum ('cash_on_delivery', 'esewa', 'khalti');
create type public.payment_status as enum ('pending', 'authorized', 'paid', 'failed', 'refunded', 'voided');
create type public.commission_status as enum ('pending', 'earned', 'paid', 'void');
create type public.assignment_status as enum ('offered', 'accepted', 'declined', 'picked_up', 'delivered', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'customer',
  full_name text not null default '',
  phone text,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'ne')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete restrict,
  name text not null,
  slug text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete restrict,
  name text not null,
  slug text not null unique,
  description text,
  phone text,
  email text,
  address_line text not null,
  city text not null,
  district text,
  province text,
  location extensions.geography(Point, 4326),
  delivery_radius_meters integer not null default 5000 check (delivery_radius_meters > 0),
  estimated_delivery_minutes integer not null default 60 check (estimated_delivery_minutes > 0),
  base_delivery_fee numeric(12,2) not null default 0 check (base_delivery_fee >= 0),
  commission_rate numeric(6,5) check (commission_rate >= 0 and commission_rate < 1),
  status public.vendor_status not null default 'pending',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_demo or owner_id is not null)
);

create table public.vendor_staff (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  staff_role text not null default 'staff' check (staff_role in ('manager', 'inventory', 'orders', 'staff')),
  is_active boolean not null default false,
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (vendor_id, user_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  brand text,
  model text,
  unit text not null default 'each',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.vendor_products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  vendor_sku text,
  price numeric(12,2) not null check (price > 0),
  currency text not null default 'NPR' check (currency = 'NPR'),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0 and reserved_quantity <= stock_quantity),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendor_id, product_id),
  unique (vendor_id, vendor_sku)
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Home',
  recipient_name text not null,
  phone text not null,
  address_line text not null,
  city text not null,
  district text,
  province text,
  location extensions.geography(Point, 4326) not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index addresses_one_default_per_user
  on public.addresses(user_id) where is_default;

create table public.riders (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status public.rider_status not null default 'offline',
  vehicle_type text,
  current_location extensions.geography(Point, 4326),
  location_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  address_id uuid references public.addresses(id) on delete set null,
  delivery_address_snapshot jsonb not null,
  status public.order_status not null default 'pending',
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'pending',
  subtotal numeric(12,2) not null check (subtotal >= 0),
  delivery_fee numeric(12,2) not null check (delivery_fee >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null check (total = subtotal + delivery_fee - discount),
  commission_rate_snapshot numeric(6,5) not null check (commission_rate_snapshot >= 0 and commission_rate_snapshot < 1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  vendor_product_id uuid not null references public.vendor_products(id) on delete restrict,
  product_name_snapshot text not null,
  unit_snapshot text not null,
  unit_price_snapshot numeric(12,2) not null check (unit_price_snapshot > 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total = unit_price_snapshot * quantity),
  created_at timestamptz not null default now()
);

create table public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  rider_id uuid references public.riders(user_id) on delete restrict,
  status public.assignment_status not null default 'offered',
  distance_to_vendor_meters double precision check (distance_to_vendor_meters >= 0),
  offered_at timestamptz not null default now(),
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index one_active_assignment_per_order
  on public.delivery_assignments(order_id)
  where status in ('offered', 'accepted', 'picked_up');

create unique index one_active_assignment_per_rider
  on public.delivery_assignments(rider_id)
  where rider_id is not null and status in ('offered', 'accepted', 'picked_up');

create table public.rider_location_history (
  id bigint generated always as identity primary key,
  rider_id uuid not null references public.riders(user_id) on delete cascade,
  location extensions.geography(Point, 4326) not null,
  accuracy_meters double precision check (accuracy_meters is null or accuracy_meters >= 0),
  recorded_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'NPR' check (currency = 'NPR'),
  provider_reference text,
  idempotency_key text unique,
  provider_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  subtotal_snapshot numeric(12,2) not null check (subtotal_snapshot >= 0),
  rate_snapshot numeric(6,5) not null check (rate_snapshot >= 0 and rate_snapshot < 1),
  commission_amount numeric(12,2) not null check (commission_amount = round(subtotal_snapshot * rate_snapshot, 2)),
  vendor_payout numeric(12,2) not null check (vendor_payout = subtotal_snapshot - commission_amount),
  status public.commission_status not null default 'pending',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete restrict,
  from_status public.order_status,
  to_status public.order_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index vendors_location_gix on public.vendors using gist(location);
create index addresses_location_gix on public.addresses using gist(location);
create index riders_location_gix on public.riders using gist(current_location);
create index rider_history_location_gix on public.rider_location_history using gist(location);
create index vendor_products_product_active_idx on public.vendor_products(product_id, is_active);
create index vendor_products_vendor_idx on public.vendor_products(vendor_id);
create index orders_customer_created_idx on public.orders(customer_id, created_at desc);
create index orders_vendor_status_created_idx on public.orders(vendor_id, status, created_at desc);
create index order_items_order_idx on public.order_items(order_id);
create index assignments_rider_status_idx on public.delivery_assignments(rider_id, status);
create index payments_order_idx on public.payments(order_id);
create index commissions_vendor_status_idx on public.commissions(vendor_id, status);
create index history_order_created_idx on public.order_status_history(order_id, created_at);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();
create trigger vendors_set_updated_at before update on public.vendors
for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger vendor_products_set_updated_at before update on public.vendor_products
for each row execute function public.set_updated_at();
create trigger addresses_set_updated_at before update on public.addresses
for each row execute function public.set_updated_at();
create trigger riders_set_updated_at before update on public.riders
for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();
create trigger assignments_set_updated_at before update on public.delivery_assignments
for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.set_vendor_owner_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id is not null and not new.is_demo then
    update public.profiles set role = 'vendor_owner'
    where id = new.owner_id and role = 'customer';
  end if;
  return new;
end;
$$;
create trigger vendors_set_owner_role after insert on public.vendors
for each row execute function public.set_vendor_owner_role();

create or replace function public.set_rider_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set role = 'rider'
  where id = new.user_id and role = 'customer';
  return new;
end;
$$;
create trigger riders_set_profile_role after insert on public.riders
for each row execute function public.set_rider_role();

create or replace function public.set_vendor_staff_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_active then
    update public.profiles set role = 'vendor_staff'
    where id = new.user_id and role = 'customer';
  end if;
  return new;
end;
$$;
create trigger vendor_staff_set_profile_role_insert after insert on public.vendor_staff
for each row execute function public.set_vendor_staff_role();
create trigger vendor_staff_set_profile_role_update after update of is_active on public.vendor_staff
for each row execute function public.set_vendor_staff_role();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

create or replace function public.is_vendor_member(p_vendor_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.vendors v
    where v.id = p_vendor_id and v.owner_id = (select auth.uid())
  ) or exists (
    select 1 from public.vendor_staff s
    where s.vendor_id = p_vendor_id and s.user_id = (select auth.uid()) and s.is_active
  );
$$;

create or replace function public.is_vendor_owner(p_vendor_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.vendors v
    where v.id = p_vendor_id and v.owner_id = (select auth.uid())
  );
$$;

create or replace function public.can_manage_vendor_inventory(p_vendor_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_vendor_owner(p_vendor_id) or exists (
    select 1 from public.vendor_staff s
    where s.vendor_id = p_vendor_id
      and s.user_id = (select auth.uid())
      and s.is_active
      and s.staff_role in ('manager', 'inventory')
  );
$$;

create or replace function public.can_access_order(p_order_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and (
        o.customer_id = (select auth.uid())
        or public.is_vendor_member(o.vendor_id)
        or exists (
          select 1 from public.delivery_assignments da
          where da.order_id = o.id and da.rider_id = (select auth.uid())
        )
        or public.is_admin()
      )
  );
$$;

create or replace function public.can_access_financial_order(p_order_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id
      and (
        o.customer_id = (select auth.uid())
        or public.is_vendor_owner(o.vendor_id)
        or public.is_admin()
      )
  );
$$;

create or replace function public.record_order_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history(order_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, (select auth.uid()));
  elsif old.status is distinct from new.status then
    insert into public.order_status_history(order_id, from_status, to_status, changed_by, note)
    values (
      new.id, old.status, new.status, (select auth.uid()),
      nullif(current_setting('app.order_status_note', true), '')
    );
  end if;
  return new;
end;
$$;

create trigger orders_record_status_change_insert
after insert on public.orders
for each row execute function public.record_order_status_change();
create trigger orders_record_status_change_update
after update of status on public.orders
for each row execute function public.record_order_status_change();

create or replace function public.search_nearby_vendors(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters integer default 10000,
  p_limit integer default 20
)
returns table (vendor_id uuid, vendor_name text, distance_meters double precision, estimated_delivery_minutes integer, delivery_fee numeric)
language sql stable security invoker set search_path = '' as $$
  select v.id, v.name,
    extensions.st_distance(v.location, extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography),
    v.estimated_delivery_minutes, v.base_delivery_fee
  from public.vendors v
  where v.status = 'active'
    and v.location is not null
    and p_latitude between -90 and 90
    and p_longitude between -180 and 180
    and extensions.st_dwithin(
      v.location,
      extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
      least(greatest(1, least(coalesce(p_radius_meters, 10000), 100000)), v.delivery_radius_meters)
    )
  order by 3, v.estimated_delivery_minutes, v.base_delivery_fee
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

create or replace function public.search_nearby_products(
  p_query text,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters integer default 10000,
  p_limit integer default 50
)
returns table (
  product_id uuid, vendor_product_id uuid, vendor_id uuid, product_name text,
  vendor_name text, price numeric, available_stock integer, in_stock boolean,
  distance_meters double precision, estimated_delivery_minutes integer, category_slug text
)
language sql stable security invoker set search_path = '' as $$
  select p.id, vp.id, v.id, p.name, v.name, vp.price,
    greatest(vp.stock_quantity - vp.reserved_quantity, 0),
    vp.stock_quantity > vp.reserved_quantity,
    extensions.st_distance(v.location, extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography),
    v.estimated_delivery_minutes, c.slug
  from public.products p
  join public.vendor_products vp on vp.product_id = p.id and vp.is_active
  join public.vendors v on v.id = vp.vendor_id and v.status = 'active'
  left join public.categories c on c.id = p.category_id
  where p.is_active
    and v.location is not null
    and p_latitude between -90 and 90
    and p_longitude between -180 and 180
    and (p_query is null or p.name ilike '%' || p_query || '%')
    and extensions.st_dwithin(
      v.location,
      extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
      least(greatest(1, least(coalesce(p_radius_meters, 10000), 100000)), v.delivery_radius_meters)
    )
  order by (vp.stock_quantity > vp.reserved_quantity) desc,
    9, v.estimated_delivery_minutes, vp.price
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

create or replace function public.create_order(
  p_vendor_id uuid,
  p_address_id uuid,
  p_items jsonb,
  p_payment_method public.payment_method default 'cash_on_delivery'
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_customer_id uuid := (select auth.uid());
  v_vendor record;
  v_address record;
  v_item record;
  v_inventory record;
  v_vendor_product_id uuid;
  v_quantity integer;
  v_subtotal numeric(12,2) := 0;
  v_total numeric(12,2);
  v_order_id uuid;
  v_snapshots jsonb := '[]'::jsonb;
  v_snapshot jsonb;
begin
  if v_customer_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Order items must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Order must contain between 1 and 50 items' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) as items(item)
    group by item->>'vendor_product_id' having count(*) > 1
  ) then
    raise exception 'Duplicate inventory item in order' using errcode = '22023';
  end if;

  select v.id, v.status, v.location, v.delivery_radius_meters,
    v.base_delivery_fee, v.commission_rate
  into v_vendor
  from public.vendors v
  where v.id = p_vendor_id
  for share;
  if not found then
    raise exception 'Selected shop is unavailable' using errcode = 'P0001';
  end if;
  if v_vendor.status <> 'active' or v_vendor.commission_rate is null then
    raise exception 'Selected shop is unavailable' using errcode = 'P0001';
  end if;

  select a.id, a.recipient_name, a.phone, a.address_line, a.city,
    a.district, a.province, a.location
  into v_address
  from public.addresses a
  where a.id = p_address_id and a.user_id = v_customer_id;
  if not found then
    raise exception 'Delivery address not found' using errcode = 'P0001';
  end if;
  if v_vendor.location is null or not extensions.st_dwithin(
    v_vendor.location, v_address.location, v_vendor.delivery_radius_meters
  ) then
    raise exception 'Selected shop does not deliver to this address' using errcode = 'P0001';
  end if;

  for v_item in
    select value as item from jsonb_array_elements(p_items)
    order by value->>'vendor_product_id'
  loop
    v_vendor_product_id := (v_item.item->>'vendor_product_id')::uuid;
    v_quantity := (v_item.item->>'quantity')::integer;
    if v_quantity is null or v_quantity < 1 or v_quantity > 999 then
      raise exception 'Invalid quantity' using errcode = '22023';
    end if;

    select vp.id, vp.price, vp.stock_quantity, vp.reserved_quantity,
      p.name as product_name, p.unit
    into v_inventory
    from public.vendor_products vp
    join public.products p on p.id = vp.product_id
    where vp.id = v_vendor_product_id
      and vp.vendor_id = p_vendor_id
      and vp.is_active and p.is_active
    for update of vp;
    if not found then
      raise exception 'A selected product is no longer available' using errcode = 'P0001';
    end if;
    if v_inventory.stock_quantity - v_inventory.reserved_quantity < v_quantity then
      raise exception 'A selected product no longer has enough stock' using errcode = 'P0001';
    end if;

    update public.vendor_products
    set reserved_quantity = reserved_quantity + v_quantity
    where id = v_inventory.id;
    v_subtotal := v_subtotal + round(v_inventory.price * v_quantity, 2);
    v_snapshots := v_snapshots || jsonb_build_array(jsonb_build_object(
      'vendor_product_id', v_inventory.id,
      'product_name', v_inventory.product_name,
      'unit', v_inventory.unit,
      'unit_price', v_inventory.price,
      'quantity', v_quantity,
      'line_total', round(v_inventory.price * v_quantity, 2)
    ));
  end loop;

  v_total := v_subtotal + v_vendor.base_delivery_fee;
  insert into public.orders (
    customer_id, vendor_id, address_id, delivery_address_snapshot,
    status, payment_method, payment_status, subtotal, delivery_fee,
    discount, total, commission_rate_snapshot
  ) values (
    v_customer_id, p_vendor_id, p_address_id,
    jsonb_build_object(
      'recipient_name', v_address.recipient_name,
      'phone', v_address.phone,
      'address_line', v_address.address_line,
      'city', v_address.city,
      'district', v_address.district,
      'province', v_address.province,
      'latitude', extensions.st_y(v_address.location::extensions.geometry),
      'longitude', extensions.st_x(v_address.location::extensions.geometry)
    ),
    'pending', p_payment_method, 'pending', v_subtotal,
    v_vendor.base_delivery_fee, 0, v_total, v_vendor.commission_rate
  ) returning id into v_order_id;

  for v_snapshot in select value from jsonb_array_elements(v_snapshots)
  loop
    insert into public.order_items (
      order_id, vendor_product_id, product_name_snapshot, unit_snapshot,
      unit_price_snapshot, quantity, line_total
    ) values (
      v_order_id,
      (v_snapshot->>'vendor_product_id')::uuid,
      v_snapshot->>'product_name',
      v_snapshot->>'unit',
      (v_snapshot->>'unit_price')::numeric,
      (v_snapshot->>'quantity')::integer,
      (v_snapshot->>'line_total')::numeric
    );
  end loop;

  insert into public.commissions (
    order_id, vendor_id, subtotal_snapshot, rate_snapshot,
    commission_amount, vendor_payout
  ) values (
    v_order_id, p_vendor_id, v_subtotal, v_vendor.commission_rate,
    round(v_subtotal * v_vendor.commission_rate, 2),
    v_subtotal - round(v_subtotal * v_vendor.commission_rate, 2)
  );
  return v_order_id;
end;
$$;

create or replace function public.cancel_pending_order(
  p_order_id uuid,
  p_note text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_order record;
  v_line record;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select o.id, o.customer_id, o.status into v_order
  from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if v_order.customer_id <> v_actor then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if v_order.status <> 'pending' then
    raise exception 'Only pending orders can be cancelled by the customer' using errcode = '22023';
  end if;

  for v_line in
    select oi.vendor_product_id, sum(oi.quantity)::integer as quantity
    from public.order_items oi
    where oi.order_id = p_order_id
    group by oi.vendor_product_id
    order by oi.vendor_product_id
  loop
    update public.vendor_products vp
    set reserved_quantity = vp.reserved_quantity - v_line.quantity
    where vp.id = v_line.vendor_product_id
      and vp.reserved_quantity >= v_line.quantity;
    if not found then
      raise exception 'Reserved stock could not be released safely' using errcode = 'P0001';
    end if;
  end loop;

  perform set_config('app.order_status_note', coalesce(left(p_note, 500), ''), true);
  update public.orders set status = 'cancelled' where id = p_order_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.vendors enable row level security;
alter table public.vendor_staff enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.vendor_products enable row level security;
alter table public.addresses enable row level security;
alter table public.riders enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.delivery_assignments enable row level security;
alter table public.rider_location_history enable row level security;
alter table public.payments enable row level security;
alter table public.commissions enable row level security;
alter table public.order_status_history enable row level security;

create policy profiles_read_self_or_admin on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy categories_read_active on public.categories for select to anon, authenticated
  using (is_active);
create policy categories_admin_manage on public.categories for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy vendors_read_active on public.vendors for select to anon, authenticated
  using (status = 'active');
create policy vendors_member_admin_read on public.vendors for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_vendor_member(id)) or (select public.is_admin()));
create policy vendors_owner_insert on public.vendors for insert to authenticated
  with check (owner_id = (select auth.uid()) and status = 'pending' and commission_rate is null and not is_demo);
create policy vendors_owner_update on public.vendors for update to authenticated
  using ((select public.is_vendor_owner(id)))
  with check ((select public.is_vendor_owner(id)));
create policy vendors_admin_all on public.vendors for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy vendor_staff_member_read on public.vendor_staff for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_vendor_member(vendor_id)) or (select public.is_admin()));
create policy vendor_staff_owner_insert on public.vendor_staff for insert to authenticated
  with check (((select public.is_vendor_owner(vendor_id)) or (select public.is_admin())) and is_active = false);
create policy vendor_staff_owner_update on public.vendor_staff for update to authenticated
  using ((select public.is_vendor_owner(vendor_id)) or (select public.is_admin()))
  with check ((select public.is_vendor_owner(vendor_id)) or (select public.is_admin()));
create policy vendor_staff_owner_delete on public.vendor_staff for delete to authenticated
  using ((select public.is_vendor_owner(vendor_id)) or (select public.is_admin()));

create policy products_read_active on public.products for select to anon, authenticated
  using (is_active);
create policy products_admin_manage on public.products for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy product_images_read on public.product_images for select to anon, authenticated
  using (true);
create policy product_images_admin_manage on public.product_images for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy vendor_products_read_active on public.vendor_products for select to anon, authenticated
  using (is_active and exists (select 1 from public.vendors v where v.id = vendor_id and v.status = 'active'));
create policy vendor_products_member_admin_read on public.vendor_products for select to authenticated
  using ((select public.is_vendor_member(vendor_id)) or (select public.is_admin()));
create policy vendor_products_member_insert on public.vendor_products for insert to authenticated
  with check (((select public.can_manage_vendor_inventory(vendor_id)) or (select public.is_admin())) and reserved_quantity = 0);
create policy vendor_products_member_update on public.vendor_products for update to authenticated
  using ((select public.can_manage_vendor_inventory(vendor_id)) or (select public.is_admin()))
  with check ((select public.can_manage_vendor_inventory(vendor_id)) or (select public.is_admin()));
create policy vendor_products_member_delete on public.vendor_products for delete to authenticated
  using ((select public.can_manage_vendor_inventory(vendor_id)) or (select public.is_admin()));

create policy addresses_owner_all on public.addresses for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy riders_owner_or_admin_read on public.riders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy riders_self_insert on public.riders for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'offline');
create policy riders_admin_update on public.riders for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy orders_participant_read on public.orders for select to authenticated
  using ((select public.can_access_order(id)));
create policy order_items_participant_read on public.order_items for select to authenticated
  using ((select public.can_access_order(order_id)));
create policy assignments_participant_read on public.delivery_assignments for select to authenticated
  using ((select public.can_access_order(order_id)) or rider_id = (select auth.uid()));
create policy rider_history_participant_read on public.rider_location_history for select to authenticated
  using (
    rider_id = (select auth.uid()) or (select public.is_admin()) or exists (
      select 1 from public.delivery_assignments da
      where da.rider_id = rider_location_history.rider_id
        and da.status in ('accepted', 'picked_up')
        and (select public.can_access_order(da.order_id))
    )
  );
create policy payments_participant_read on public.payments for select to authenticated
  using ((select public.can_access_financial_order(order_id)));
create policy commissions_vendor_or_admin_read on public.commissions for select to authenticated
  using ((select public.is_vendor_owner(vendor_id)) or (select public.is_admin()));
create policy order_history_participant_read on public.order_status_history for select to authenticated
  using ((select public.can_access_order(order_id)));

revoke all on all tables in schema public from anon, authenticated;
grant select on public.categories, public.vendors, public.products, public.product_images, public.vendor_products to anon, authenticated;
grant insert, update, delete on public.categories, public.products, public.product_images to authenticated;
grant select on public.profiles, public.vendor_staff, public.addresses, public.riders,
  public.orders, public.order_items, public.delivery_assignments, public.rider_location_history,
  public.payments, public.commissions, public.order_status_history to authenticated;
grant update (full_name, phone, preferred_language) on public.profiles to authenticated;
grant insert, update, delete on public.addresses to authenticated;
grant insert (owner_id, name, slug, description, phone, email, address_line, city, district, province, location, delivery_radius_meters, estimated_delivery_minutes, base_delivery_fee)
  on public.vendors to authenticated;
grant update (name, slug, description, phone, email, address_line, city, district, province, location, delivery_radius_meters, estimated_delivery_minutes, base_delivery_fee)
  on public.vendors to authenticated;
grant insert (vendor_id, user_id, staff_role, invited_by) on public.vendor_staff to authenticated;
grant update (is_active, staff_role) on public.vendor_staff to authenticated;
grant delete on public.vendor_staff to authenticated;
grant insert (vendor_id, product_id, vendor_sku, price, currency, stock_quantity, is_active)
  on public.vendor_products to authenticated;
grant update (vendor_sku, price, currency, stock_quantity, is_active)
  on public.vendor_products to authenticated;
grant delete on public.vendor_products to authenticated;
grant insert (user_id, vehicle_type) on public.riders to authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.record_order_status_change() from public, anon, authenticated;
revoke all on function public.set_vendor_owner_role() from public, anon, authenticated;
revoke all on function public.set_rider_role() from public, anon, authenticated;
revoke all on function public.set_vendor_staff_role() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_vendor_member(uuid) from public, anon;
revoke all on function public.is_vendor_owner(uuid) from public, anon;
revoke all on function public.can_manage_vendor_inventory(uuid) from public, anon;
revoke all on function public.can_access_order(uuid) from public, anon;
revoke all on function public.can_access_financial_order(uuid) from public, anon;
revoke all on function public.search_nearby_vendors(double precision, double precision, integer, integer) from public;
revoke all on function public.search_nearby_products(text, double precision, double precision, integer, integer) from public;
revoke all on function public.create_order(uuid, uuid, jsonb, public.payment_method) from public, anon;
revoke all on function public.cancel_pending_order(uuid, text) from public, anon;
grant execute on function public.is_admin(), public.is_vendor_member(uuid), public.is_vendor_owner(uuid), public.can_manage_vendor_inventory(uuid), public.can_access_order(uuid), public.can_access_financial_order(uuid) to authenticated;
grant execute on function public.search_nearby_vendors(double precision, double precision, integer, integer) to anon, authenticated;
grant execute on function public.search_nearby_products(text, double precision, double precision, integer, integer) to anon, authenticated;
grant execute on function public.create_order(uuid, uuid, jsonb, public.payment_method) to authenticated;
grant execute on function public.cancel_pending_order(uuid, text) to authenticated;

do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array['orders', 'delivery_assignments', 'riders'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;
