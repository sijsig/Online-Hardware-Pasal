-- Hardware Online Pasal - Extended Schema for Marketplace Flow
-- Adds: riders, delivery_assignments, payments, commissions, rider_incentives, vendor_notifications, vendor_products
-- With security, transparency, accountability built-in

-- 1. Extended order_status enum
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'preparing';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'ready_for_pickup';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'picked_up';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'out_for_delivery';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'returned';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'disputed';

-- 2. Riders table
create table if not exists public.riders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vehicle_type text not null check (vehicle_type in ('bike', 'scooter', 'bicycle', 'van')),
  vehicle_number text,
  license_number text,
  status text not null default 'offline' check (status in ('offline', 'available', 'busy', 'suspended')),
  current_latitude double precision,
  current_longitude double precision,
  last_location_update timestamptz,
  rating numeric(3,2) default 5.0 check (rating >= 0 and rating <= 5),
  total_deliveries integer default 0,
  total_earnings numeric(12,2) default 0,
  is_verified boolean default false,
  verification_documents jsonb default '{}',
  application_status text default 'pending' check (application_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_riders_status on public.riders (status);
create index if not exists idx_riders_location on public.riders (current_latitude, current_longitude);
create index if not exists idx_riders_user on public.riders (user_id);

alter table public.riders enable row level security;

create policy "Riders can view their own profile" on public.riders for select using (auth.uid() = user_id);
create policy "Riders can update their own profile" on public.riders for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Admins can manage all riders" on public.riders for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')) with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- 3. Delivery Assignments table
create table if not exists public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  rider_id uuid not null references public.riders (id) on delete restrict,
  vendor_id uuid not null references public.shops (id) on delete restrict,
  status text not null default 'offered' check (status in ('offered', 'accepted', 'picked_up', 'delivered', 'cancelled', 'rejected')),
  offered_at timestamptz not null default now(),
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  rejection_reason text,
  pickup_latitude double precision,
  pickup_longitude double precision,
  dropoff_latitude double precision,
  dropoff_longitude double precision,
  estimated_distance_km numeric(8,2),
  actual_distance_km numeric(8,2),
  incentive_amount numeric(12,2) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_delivery_assignments_order on public.delivery_assignments (order_id);
create index if not exists idx_delivery_assignments_rider on public.delivery_assignments (rider_id);
create index if not exists idx_delivery_assignments_status on public.delivery_assignments (status);

alter table public.delivery_assignments enable row level security;

create policy "Riders can view their assignments" on public.delivery_assignments for select using (exists (select 1 from public.riders where id = rider_id and user_id = auth.uid()));
create policy "Riders can update their assignments" on public.delivery_assignments for update using (exists (select 1 from public.riders where id = rider_id and user_id = auth.uid())) with check (exists (select 1 from public.riders where id = rider_id and user_id = auth.uid()));
create policy "Vendors can view assignments for their orders" on public.delivery_assignments for select using (exists (select 1 from public.shops where id = vendor_id and owner_id = auth.uid()));
create policy "Admins can manage all assignments" on public.delivery_assignments for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')) with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "Customers can view their order assignments" on public.delivery_assignments for select using (exists (select 1 from public.orders where id = order_id and buyer_id = auth.uid()));

-- 4. Payments table (COD tracking)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'NPR',
  method text not null default 'cod' check (method in ('cod', 'online', 'wallet', 'bank_transfer')),
  status text not null default 'pending' check (status in ('pending', 'collected', 'verified', 'released', 'disputed', 'refunded')),
  collected_by uuid references public.riders (id) on delete set null,
  collected_at timestamptz,
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  released_at timestamptz,
  collection_notes text,
  proof_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_order on public.payments (order_id);
create index if not exists idx_payments_rider on public.payments (collected_by);
create index if not exists idx_payments_status on public.payments (status);

alter table public.payments enable row level security;

create policy "Riders can view payments they collected" on public.payments for select using (collected_by in (select id from public.riders where user_id = auth.uid()));
create policy "Riders can create payment records for their deliveries" on public.payments for insert with check (collected_by in (select id from public.riders where user_id = auth.uid()));
create policy "Vendors can view payments for their orders" on public.payments for select using (exists (select 1 from public.orders o join public.shops s on s.id = o.shop_id where o.id = order_id and s.owner_id = auth.uid()));
create policy "Admins can manage all payments" on public.payments for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')) with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "Customers can view payments for their orders" on public.payments for select using (exists (select 1 from public.orders where id = order_id and buyer_id = auth.uid()));

-- 5. Commissions table (platform commission per order)
create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  vendor_id uuid not null references public.shops (id) on delete restrict,
  subtotal_snapshot numeric(12,2) not null,
  commission_rate numeric(5,4) not null check (commission_rate >= 0 and commission_rate <= 1),
  commission_amount numeric(12,2) not null check (commission_amount >= 0),
  vendor_payout numeric(12,2) not null check (vendor_payout >= 0),
  status text not null default 'earned' check (status in ('earned', 'paid_out', 'disputed', 'adjusted')),
  payout_reference text,
  paid_out_at timestamptz,
  paid_out_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_commissions_order on public.commissions (order_id);
create index if not exists idx_commissions_vendor on public.commissions (vendor_id);
create index if not exists idx_commissions_status on public.commissions (status);

alter table public.commissions enable row level security;

create policy "Vendors can view their commissions" on public.commissions for select using (exists (select 1 from public.shops where id = vendor_id and owner_id = auth.uid()));
create policy "Admins can manage all commissions" on public.commissions for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')) with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- 6. Rider Incentives table (2% of margin tracking)
create table if not exists public.rider_incentives (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.riders (id) on delete cascade,
  delivery_assignment_id uuid not null references public.delivery_assignments (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  margin_amount numeric(12,2) not null,
  incentive_rate numeric(5,4) not null default 0.02 check (incentive_rate >= 0 and incentive_rate <= 1),
  incentive_amount numeric(12,2) not null check (incentive_amount >= 0),
  status text not null default 'earned' check (status in ('earned', 'paid_out', 'disputed')),
  paid_out_at timestamptz,
  paid_out_by uuid references auth.users (id) on delete set null,
  payout_reference text,
  created_at timestamptz not null default now()
);

create index if not exists idx_rider_incentives_rider on public.rider_incentives (rider_id);
create index if not exists idx_rider_incentives_assignment on public.rider_incentives (delivery_assignment_id);

alter table public.rider_incentives enable row level security;

create policy "Riders can view their incentives" on public.rider_incentives for select using (rider_id in (select id from public.riders where user_id = auth.uid()));
create policy "Admins can manage all incentives" on public.rider_incentives for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')) with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- 7. Vendor Notifications table (push notification tracking)
create table if not exists public.vendor_notifications (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.shops (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  type text not null check (type in ('new_order', 'order_confirmed', 'order_cancelled', 'payment_received', 'payout_processed', 'rider_assigned', 'delivery_update')),
  title text not null,
  body text not null,
  data jsonb default '{}',
  sent_at timestamptz not null default now(),
  read_at timestamptz,
  push_token text,
  push_sent boolean default false,
  push_response jsonb
);

create index if not exists idx_vendor_notifications_vendor on public.vendor_notifications (vendor_id, sent_at desc);
create index if not exists idx_vendor_notifications_order on public.vendor_notifications (order_id);

alter table public.vendor_notifications enable row level security;

create policy "Vendors can view their notifications" on public.vendor_notifications for select using (exists (select 1 from public.shops where id = vendor_id and owner_id = auth.uid()));
create policy "System can insert notifications" on public.vendor_notifications for insert with check (true);

-- 8. Vendor Products table (per-shop pricing/stock for catalog items)
create table if not exists public.vendor_products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.shops (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  vendor_sku text,
  price numeric(12,2) not null check (price > 0),
  compare_at_price numeric(12,2),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  is_active boolean not null default true,
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendor_id, product_id)
);

create index if not exists idx_vendor_products_vendor on public.vendor_products (vendor_id);
create index if not exists idx_vendor_products_product on public.vendor_products (product_id);
create index if not exists idx_vendor_products_active on public.vendor_products (is_active);

alter table public.vendor_products enable row level security;

create policy "Vendors can manage their products" on public.vendor_products for all using (exists (select 1 from public.shops where id = vendor_id and owner_id = auth.uid())) with check (exists (select 1 from public.shops where id = vendor_id and owner_id = auth.uid()));
create policy "Customers can view active vendor products" on public.vendor_products for select using (is_active = true and approval_status = 'approved');
create policy "Admins can manage all vendor products" on public.vendor_products for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')) with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- 9. Vendor Product Submissions (for new catalog items)
create table if not exists public.vendor_product_submissions (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.shops (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  product_name text not null,
  brand text,
  model text,
  unit text not null default 'each',
  price numeric(12,2) not null check (price > 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  vendor_sku text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vendor_product_submissions_vendor on public.vendor_product_submissions (vendor_id);
create index if not exists idx_vendor_product_submissions_status on public.vendor_product_submissions (status);

alter table public.vendor_product_submissions enable row level security;

create policy "Vendors can view their submissions" on public.vendor_product_submissions for select using (exists (select 1 from public.shops where id = vendor_id and owner_id = auth.uid()));
create policy "Vendors can create submissions" on public.vendor_product_submissions for insert with check (exists (select 1 from public.shops where id = vendor_id and owner_id = auth.uid()));
create policy "Admins can manage all submissions" on public.vendor_product_submissions for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')) with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- 10. Audit Logs table (transparency & accountability)
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  actor_role text,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb default '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_actor on public.audit_logs (actor_id);
create index if not exists idx_audit_logs_resource on public.audit_logs (resource_type, resource_id);
create index if not exists idx_audit_logs_created on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;

create policy "Admins can view all audit logs" on public.audit_logs for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "System can insert audit logs" on public.audit_logs for insert with check (true);

-- 11. Profiles: add role column if not exists
alter table public.profiles add column if not exists role text not null default 'customer' check (role in ('customer', 'vendor_owner', 'vendor_staff', 'rider', 'admin'));

create index if not exists idx_profiles_role on public.profiles (role);

-- 12. Shops: add commission_rate column
alter table public.shops add column if not exists commission_rate numeric(5,4) not null default 0.10 check (commission_rate >= 0 and commission_rate <= 1);
alter table public.shops add column if not exists status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'rejected'));

-- 13. Products: add cost_price for margin calculation
alter table public.products add column if not exists cost_price numeric(12,2) check (cost_price >= 0);
alter table public.products add column if not exists is_active boolean not null default true;
alter table public.products add column if not exists sort_order integer default 0;

-- 14. Categories: add is_active and sort_order
alter table public.categories add column if not exists is_active boolean not null default true;
alter table public.categories add column if not exists sort_order integer default 0;

-- 15. Orders: add vendor_confirmed_at, rider_assigned_at, etc.
alter table public.orders add column if not exists vendor_confirmed_at timestamptz;
alter table public.orders add column if not exists rider_assigned_at timestamptz;
alter table public.orders add column if not exists picked_up_at timestamptz;
alter table public.orders add column if not exists delivered_at timestamptz;
alter table public.orders add column if not exists delivery_fee numeric(12,2) default 0;
alter table public.orders add column if not exists platform_fee numeric(12,2) default 0;
alter table public.orders add column if not exists cod_amount numeric(12,2) default 0;

-- 16. Updated_at triggers for new tables
create trigger riders_set_updated_at
before update on public.riders
for each row execute function public.set_updated_at();

create trigger delivery_assignments_set_updated_at
before update on public.delivery_assignments
for each row execute function public.set_updated_at();

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create trigger commissions_set_updated_at
before update on public.commissions
for each row execute function public.set_updated_at();

create trigger vendor_products_set_updated_at
before update on public.vendor_products
for each row execute function public.set_updated_at();

create trigger vendor_product_submissions_set_updated_at
before update on public.vendor_product_submissions
for each row execute function public.set_updated_at();

-- 17. RPC: Find nearest vendor with product in stock
create or replace function public.find_nearest_vendor(
  p_product_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_km numeric default 20
)
returns table (
  vendor_id uuid,
  vendor_name text,
  distance_km numeric,
  price numeric,
  stock_quantity integer,
  estimated_delivery_minutes integer
)
language plpgsql
security definer
as $$
begin
  return query
  select
    vp.vendor_id,
    s.name as vendor_name,
    round((
      6371 * acos(
        cos(radians(p_latitude)) * cos(radians(s.latitude)) *
        cos(radians(s.longitude) - radians(p_longitude)) +
        sin(radians(p_latitude)) * sin(radians(s.latitude))
      )
    )::numeric, 2) as distance_km,
    vp.price,
    (vp.stock_quantity - vp.reserved_quantity) as stock_quantity,
    case
      when round((
        6371 * acos(
          cos(radians(p_latitude)) * cos(radians(s.latitude)) *
          cos(radians(s.longitude) - radians(p_longitude)) +
          sin(radians(p_latitude)) * sin(radians(s.latitude))
        )
      )::numeric, 2) <= 5 then 30
      when round((
        6371 * acos(
          cos(radians(p_latitude)) * cos(radians(s.latitude)) *
          cos(radians(s.longitude) - radians(p_longitude)) +
          sin(radians(p_latitude)) * sin(radians(s.latitude))
        )
      )::numeric, 2) <= 10 then 60
      else 90
    end as estimated_delivery_minutes
  from public.vendor_products vp
  join public.shops s on s.id = vp.vendor_id
  where vp.product_id = p_product_id
    and vp.is_active = true
    and vp.approval_status = 'approved'
    and (vp.stock_quantity - vp.reserved_quantity) > 0
    and s.is_active = true
    and s.status = 'active'
    and s.latitude is not null
    and s.longitude is not null
    and 6371 * acos(
      cos(radians(p_latitude)) * cos(radians(s.latitude)) *
      cos(radians(s.longitude) - radians(p_longitude)) +
      sin(radians(p_latitude)) * sin(radians(s.latitude))
    ) <= p_radius_km
  order by distance_km asc
  limit 5;
end;
$$;

-- 18. RPC: Find nearest available rider
create or replace function public.find_nearest_rider(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_km numeric default 10
)
returns table (
  rider_id uuid,
  rider_name text,
  vehicle_type text,
  distance_km numeric,
  rating numeric,
  total_deliveries integer
)
language plpgsql
security definer
as $$
begin
  return query
  select
    r.id as rider_id,
    p.full_name as rider_name,
    r.vehicle_type,
    round((
      6371 * acos(
        cos(radians(p_latitude)) * cos(radians(r.current_latitude)) *
        cos(radians(r.current_longitude) - radians(p_longitude)) +
        sin(radians(p_latitude)) * sin(radians(r.current_latitude))
      )
    )::numeric, 2) as distance_km,
    r.rating,
    r.total_deliveries
  from public.riders r
  join public.profiles p on p.id = r.user_id
  where r.status = 'available'
    and r.current_latitude is not null
    and r.current_longitude is not null
    and r.is_verified = true
    and r.application_status = 'approved'
    and r.last_location_update > now() - interval '10 minutes'
    and 6371 * acos(
      cos(radians(p_latitude)) * cos(radians(r.current_latitude)) *
      cos(radians(r.current_longitude) - radians(p_longitude)) +
      sin(radians(p_latitude)) * sin(radians(r.current_latitude))
    ) <= p_radius_km
  order by distance_km asc
  limit 3;
end;
$$;

-- 19. RPC: Calculate commission and vendor payout
create or replace function public.calculate_commission(
  p_order_id uuid
)
returns table (
  commission_amount numeric,
  vendor_payout numeric,
  commission_rate numeric
)
language plpgsql
security definer
as $$
declare
  v_order public.orders%rowtype;
  v_shop public.shops%rowtype;
  v_commission_rate numeric;
  v_commission_amount numeric;
  v_vendor_payout numeric;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'Order not found';
  end if;

  select * into v_shop from public.shops where id = v_order.shop_id;
  if not found then
    raise exception 'Shop not found';
  end if;

  v_commission_rate := v_shop.commission_rate;
  v_commission_amount := round(v_order.subtotal * v_commission_rate, 2);
  v_vendor_payout := v_order.subtotal - v_commission_amount;

  return query select v_commission_amount, v_vendor_payout, v_commission_rate;
end;
$$;

-- 20. RPC: Calculate rider incentive (2% of margin)
create or replace function public.calculate_rider_incentive(
  p_order_id uuid,
  p_delivery_assignment_id uuid
)
returns table (
  margin_amount numeric,
  incentive_amount numeric,
  incentive_rate numeric
)
language plpgsql
security definer
as $$
declare
  v_margin_total numeric := 0;
  v_incentive_rate numeric := 0.02; -- 2%
  v_incentive_amount numeric;
begin
  -- Calculate total margin for this order (sum of (price - cost_price) * quantity for all items)
  select coalesce(sum(
    (oi.unit_price - coalesce(pr.cost_price, 0)) * oi.quantity
  ), 0) into v_margin_total
  from public.order_items oi
  join public.products pr on pr.id = oi.product_id
  where oi.order_id = p_order_id;

  v_incentive_amount := round(v_margin_total * v_incentive_rate, 2);

  return query select v_margin_total, v_incentive_amount, v_incentive_rate;
end;
$$;

-- 21. RPC: Auto-assign nearest rider to order
create or replace function public.auto_assign_rider(
  p_order_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_order public.orders%rowtype;
  v_shop public.shops%rowtype;
  v_rider record;
  v_assignment_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'Order not found';
  end if;

  select * into v_shop from public.shops where id = v_order.shop_id;
  if not found then
    raise exception 'Shop not found';
  end if;

  -- Find nearest available rider
  select * into v_rider
  from public.find_nearest_rider(v_shop.latitude, v_shop.longitude, 15)
  limit 1;

  if not found then
    raise exception 'No available riders nearby';
  end if;

  -- Create delivery assignment
  insert into public.delivery_assignments (
    order_id, rider_id, vendor_id,
    pickup_latitude, pickup_longitude,
    dropoff_latitude, dropoff_longitude,
    estimated_distance_km
  ) values (
    p_order_id, v_rider.rider_id, v_order.shop_id,
    v_shop.latitude, v_shop.longitude,
    v_order.shipping_address->>'latitude',
    v_order.shipping_address->>'longitude',
    v_rider.distance_km
  ) returning id into v_assignment_id;

  -- Update order status
  update public.orders
  set status = 'out_for_delivery', rider_assigned_at = now()
  where id = p_order_id;

  -- Create notification for rider
  insert into public.vendor_notifications (vendor_id, order_id, type, title, body, data)
  select s.id, p_order_id, 'rider_assigned', 'New Delivery Assignment',
    'You have been assigned to deliver order ' || substr(p_order_id::text, 1, 8),
    jsonb_build_object('assignment_id', v_assignment_id, 'rider_id', v_rider.rider_id)
  from public.shops s where s.id = v_order.shop_id;

  return v_assignment_id;
end;
$$;


-- 22. RPC: Vendor confirms order (starts preparation)
create or replace function public.vendor_confirm_order(
  p_order_id uuid,
  p_vendor_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id and shop_id = p_vendor_id;
  if not found then
    raise exception 'Order not found or not authorized';
  end if;

  if v_order.status != 'pending' then
    raise exception 'Order cannot be confirmed from current status: ' || v_order.status;
  end if;

  update public.orders
  set status = 'confirmed', vendor_confirmed_at = now()
  where id = p_order_id;

  -- Reserve stock
  update public.vendor_products vp
  set reserved_quantity = vp.reserved_quantity + oi.quantity
  from public.order_items oi
  where oi.order_id = p_order_id
    and vp.vendor_id = p_vendor_id
    and vp.product_id = oi.product_id;

  -- Create commission record
  insert into public.commissions (order_id, vendor_id, subtotal_snapshot, commission_rate, commission_amount, vendor_payout)
  select p_order_id, p_vendor_id, v_order.subtotal, s.commission_rate,
    round(v_order.subtotal * s.commission_rate, 2),
    v_order.subtotal - round(v_order.subtotal * s.commission_rate, 2)
  from public.shops s where s.id = p_vendor_id;

  -- Log audit
  insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, new_values)
  values (auth.uid(), 'vendor_owner', 'confirm_order', 'order', p_order_id, jsonb_build_object('status', 'confirmed'));

  -- Notify customer
  insert into public.vendor_notifications (vendor_id, order_id, type, title, body)
  select p_vendor_id, p_order_id, 'order_confirmed', 'Order Confirmed',
    'Your order has been confirmed and is being prepared'
  from public.orders where id = p_order_id;
end;
$$;

-- 23. RPC: Vendor marks order ready for pickup
create or replace function public.vendor_ready_for_pickup(
  p_order_id uuid,
  p_vendor_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id and shop_id = p_vendor_id;
  if not found then
    raise exception 'Order not found or not authorized';
  end if;

  if v_order.status not in ('confirmed', 'preparing') then
    raise exception 'Order cannot be marked ready from current status: ' || v_order.status;
  end if;

  update public.orders
  set status = 'ready_for_pickup'
  where id = p_order_id;

  -- Log audit
  insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, new_values)
  values (auth.uid(), 'vendor_owner', 'ready_for_pickup', 'order', p_order_id, jsonb_build_object('status', 'ready_for_pickup'));

  -- Notify rider assignment will happen via admin or auto-assign
end;
$$;

-- 24. RPC: Rider picks up order
create or replace function public.rider_pickup_order(
  p_order_id uuid,
  p_rider_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_assignment public.delivery_assignments%rowtype;
begin
  select * into v_assignment
  from public.delivery_assignments
  where order_id = p_order_id and rider_id = p_rider_id and status in ('accepted', 'offered');

  if not found then
    raise exception 'Assignment not found or not authorized';
  end if;

  update public.delivery_assignments
  set status = 'picked_up', picked_up_at = now()
  where id = v_assignment.id;

  update public.orders
  set status = 'picked_up', picked_up_at = now()
  where id = p_order_id;

  -- Log audit
  insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, new_values)
  values (auth.uid(), 'rider', 'pickup_order', 'order', p_order_id, jsonb_build_object('status', 'picked_up'));

  -- Notify customer
  insert into public.vendor_notifications (vendor_id, order_id, type, title, body)
  select shop_id, p_order_id, 'delivery_update', 'Order Picked Up',
    'Your order has been picked up by the rider and is on the way'
  from public.orders where id = p_order_id;
end;
$$;

-- 25. RPC: Rider delivers order
create or replace function public.rider_deliver_order(
  p_order_id uuid,
  p_rider_id uuid,
  p_cod_collected boolean default false,
  p_cod_amount numeric default 0,
  p_collection_notes text default '',
  p_proof_image_url text default ''
)
returns void
language plpgsql
security definer
as $$
declare
  v_assignment public.delivery_assignments%rowtype;
  v_incentive record;
begin
  select * into v_assignment
  from public.delivery_assignments
  where order_id = p_order_id and rider_id = p_rider_id and status = 'picked_up';

  if not found then
    raise exception 'Assignment not found or not authorized';
  end if;

  update public.delivery_assignments
  set status = 'delivered', delivered_at = now()
  where id = v_assignment.id;

  update public.orders
  set status = 'delivered', delivered_at = now()
  where id = p_order_id;

  -- Release reserved stock
  update public.vendor_products vp
  set reserved_quantity = greatest(vp.reserved_quantity - oi.quantity, 0),
      stock_quantity = vp.stock_quantity - oi.quantity
  from public.order_items oi
  where oi.order_id = p_order_id
    and vp.vendor_id = v_assignment.vendor_id
    and vp.product_id = oi.product_id;

  -- Update rider stats
  update public.riders
  set total_deliveries = total_deliveries + 1
  where id = p_rider_id;

  -- Calculate and create rider incentive
  select * into v_incentive
  from public.calculate_rider_incentive(p_order_id, v_assignment.id);

  insert into public.rider_incentives (rider_id, delivery_assignment_id, order_id, margin_amount, incentive_rate, incentive_amount)
  values (p_rider_id, v_assignment.id, p_order_id, v_incentive.margin_amount, v_incentive.incentive_rate, v_incentive.incentive_amount);

  -- Update rider total earnings
  update public.riders
  set total_earnings = total_earnings + v_incentive.incentive_amount
  where id = p_rider_id;

  -- Create payment record if COD
  if p_cod_collected then
    insert into public.payments (order_id, amount, currency, method, status, collected_by, collected_at, collection_notes, proof_image_url)
    values (p_order_id, p_cod_amount, 'NPR', 'cod', 'collected', p_rider_id, now(), p_collection_notes, p_proof_image_url);
  end if;

  -- Log audit
  insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, new_values)
  values (auth.uid(), 'rider', 'deliver_order', 'order', p_order_id, jsonb_build_object('status', 'delivered', 'cod_collected', p_cod_collected));

  -- Notify customer
  insert into public.vendor_notifications (vendor_id, order_id, type, title, body)
  select shop_id, p_order_id, 'delivery_update', 'Order Delivered',
    'Your order has been delivered successfully'
  from public.orders where id = p_order_id;

  -- Notify vendor
  insert into public.vendor_notifications (vendor_id, order_id, type, title, body)
  select v_assignment.vendor_id, p_order_id, 'order_confirmed', 'Order Delivered',
    'Order has been delivered to customer'
  from public.delivery_assignments where id = v_assignment.id;
end;
$$;

-- 26. RPC: Admin verifies COD payment
create or replace function public.admin_verify_payment(
  p_payment_id uuid,
  p_admin_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_payment public.payments%rowtype;
  v_commission public.commissions%rowtype;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if not found then
    raise exception 'Payment not found';
  end if;

  if v_payment.status != 'collected' then
    raise exception 'Payment cannot be verified from current status: ' || v_payment.status;
  end if;

  -- Verify admin role
  if not exists (select 1 from public.profiles where id = p_admin_id and role = 'admin') then
    raise exception 'Not authorized';
  end if;

  update public.payments
  set status = 'verified', verified_by = p_admin_id, verified_at = now()
  where id = p_payment_id;

  -- Update commission status
  select * into v_commission from public.commissions where order_id = v_payment.order_id;
  if found then
    update public.commissions set status = 'paid_out' where id = v_commission.id;
  end if;

  -- Log audit
  insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, new_values)
  values (p_admin_id, 'admin', 'verify_payment', 'payment', p_payment_id, jsonb_build_object('status', 'verified'));
end;
$$;

-- 27. RPC: Admin processes vendor payout
create or replace function public.admin_process_vendor_payout(
  p_commission_id uuid,
  p_admin_id uuid,
  p_payout_reference text
)
returns void
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from public.profiles where id = p_admin_id and role = 'admin') then
    raise exception 'Not authorized';
  end if;

  update public.commissions
  set status = 'paid_out', payout_reference = p_payout_reference, paid_out_at = now(), paid_out_by = p_admin_id
  where id = p_commission_id;

  -- Log audit
  insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, new_values)
  values (p_admin_id, 'admin', 'process_vendor_payout', 'commission', p_commission_id, jsonb_build_object('payout_reference', p_payout_reference));
end;
$$;

-- 28. RPC: Admin processes rider incentive payout
create or replace function public.admin_process_rider_payout(
  p_incentive_id uuid,
  p_admin_id uuid,
  p_payout_reference text
)
returns void
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from public.profiles where id = p_admin_id and role = 'admin') then
    raise exception 'Not authorized';
  end if;

  update public.rider_incentives
  set status = 'paid_out', payout_reference = p_payout_reference, paid_out_at = now(), paid_out_by = p_admin_id
  where id = p_incentive_id;

  -- Log audit
  insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, new_values)
  values (p_admin_id, 'admin', 'process_rider_payout', 'rider_incentive', p_incentive_id, jsonb_build_object('payout_reference', p_payout_reference));
end;
$$;

-- 29. RPC: Get marketplace metrics for admin dashboard
create or replace function public.admin_dashboard_metrics()
returns table (
  today_orders integer,
  today_order_value numeric,
  today_commission numeric,
  active_vendors integer,
  available_riders integer,
  pending_orders integer,
  active_deliveries integer,
  pending_shop_applications integer,
  pending_rider_applications integer
)
language plpgsql
security definer
as $$
begin
  return query
  select
    (select count(*) from public.orders where created_at >= current_date) as today_orders,
    (select coalesce(sum(total), 0) from public.orders where created_at >= current_date) as today_order_value,
    (select coalesce(sum(commission_amount), 0) from public.commissions where created_at >= current_date) as today_commission,
    (select count(*) from public.shops where status = 'active') as active_vendors,
    (select count(*) from public.riders where status = 'available') as available_riders,
    (select count(*) from public.orders where status in ('pending', 'confirmed', 'preparing')) as pending_orders,
    (select count(*) from public.delivery_assignments where status in ('accepted', 'picked_up', 'out_for_delivery')) as active_deliveries,
    (select count(*) from public.shops where status = 'pending') as pending_shop_applications,
    (select count(*) from public.riders where application_status = 'pending') as pending_rider_applications;
end;
$$;

-- 30. RPC: Search nearby products (for mobile app)
create or replace function public.search_nearby_products(
  p_query text default null,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters numeric default 10000,
  p_limit integer default 40
)
returns table (
  product_id uuid,
  vendor_product_id uuid,
  vendor_id uuid,
  product_name text,
  vendor_name text,
  price numeric,
  available_stock integer,
  in_stock boolean,
  distance_meters numeric,
  estimated_delivery_minutes integer,
  category_slug text
)
language plpgsql
security definer
as $$
begin
  return query
  select
    p.id as product_id,
    vp.id as vendor_product_id,
    vp.vendor_id,
    p.name as product_name,
    s.name as vendor_name,
    vp.price,
    (vp.stock_quantity - vp.reserved_quantity) as available_stock,
    (vp.stock_quantity - vp.reserved_quantity) > 0 as in_stock,
    round((
      6371000 * acos(
        cos(radians(p_latitude)) * cos(radians(s.latitude)) *
        cos(radians(s.longitude) - radians(p_longitude)) +
        sin(radians(p_latitude)) * sin(radians(s.latitude))
      )
    )::numeric) as distance_meters,
    case
      when round((
        6371 * acos(
          cos(radians(p_latitude)) * cos(radians(s.latitude)) *
          cos(radians(s.longitude) - radians(p_longitude)) +
          sin(radians(p_latitude)) * sin(radians(s.latitude))
        )
      )::numeric, 2) <= 5 then 30
      when round((
        6371 * acos(
          cos(radians(p_latitude)) * cos(radians(s.latitude)) *
          cos(radians(s.longitude) - radians(p_longitude)) +
          sin(radians(p_latitude)) * sin(radians(s.latitude))
        )
      )::numeric, 2) <= 10 then 60
      else 90
    end as estimated_delivery_minutes,
    c.slug as category_slug
  from public.vendor_products vp
  join public.products p on p.id = vp.product_id
  join public.shops s on s.id = vp.vendor_id
  left join public.categories c on c.id = p.category_id
  where vp.is_active = true
    and vp.approval_status = 'approved'
    and (vp.stock_quantity - vp.reserved_quantity) > 0
    and s.is_active = true
    and s.status = 'active'
    and s.latitude is not null
    and s.longitude is not null
    and p.is_active = true
    and (p_query is null or p_query = '' or p.name ilike '%' || p_query || '%')
    and 6371000 * acos(
      cos(radians(p_latitude)) * cos(radians(s.latitude)) *
      cos(radians(s.longitude) - radians(p_longitude)) +
      sin(radians(p_latitude)) * sin(radians(s.latitude))
    ) <= p_radius_meters
  order by distance_meters asc
  limit p_limit;
end;
$$;


-- 31. Audit logging trigger function
create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, new_values)
    values (auth.uid(), 
      (select role from public.profiles where id = auth.uid()),
      'insert', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
  elsif TG_OP = 'UPDATE' then
    insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, old_values, new_values)
    values (auth.uid(),
      (select role from public.profiles where id = auth.uid()),
      'update', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
  elsif TG_OP = 'DELETE' then
    insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, old_values)
    values (auth.uid(),
      (select role from public.profiles where id = auth.uid()),
      'delete', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
  end if;
  return NEW;
end;
$$;

-- 32. Attach audit triggers to critical tables
create trigger orders_audit
after insert or update or delete on public.orders
for each row execute function public.audit_trigger();

create trigger payments_audit
after insert or update or delete on public.payments
for each row execute function public.audit_trigger();

create trigger commissions_audit
after insert or update or delete on public.commissions
for each row execute function public.audit_trigger();

create trigger rider_incentives_audit
after insert or update or delete on public.rider_incentives
for each row execute function public.audit_trigger();

create trigger delivery_assignments_audit
after insert or update or delete on public.delivery_assignments
for each row execute function public.audit_trigger();

create trigger vendor_products_audit
after insert or update or delete on public.vendor_products
for each row execute function public.audit_trigger();

create trigger shops_audit
after insert or update or delete on public.shops
for each row execute function public.audit_trigger();

create trigger profiles_audit
after insert or update or delete on public.profiles
for each row execute function public.audit_trigger();

-- 33. Trigger: Auto-create vendor notification on new order
create or replace function public.notify_vendor_on_new_order()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.vendor_notifications (vendor_id, order_id, type, title, body, data)
  values (NEW.shop_id, NEW.id, 'new_order', 'New Order Received',
    'You have a new order #' || substr(NEW.id::text, 1, 8),
    jsonb_build_object('order_total', NEW.total, 'items_count', (
      select count(*) from public.order_items where order_id = NEW.id
    )));
  return NEW;
end;
$$;

create trigger notify_vendor_on_new_order_trigger
after insert on public.orders
for each row execute function public.notify_vendor_on_new_order();

-- 34. Trigger: Auto-calculate commission on order confirmation
create or replace function public.auto_create_commission()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.status = 'confirmed' and OLD.status = 'pending' then
    insert into public.commissions (order_id, vendor_id, subtotal_snapshot, commission_rate, commission_amount, vendor_payout)
    select NEW.id, NEW.shop_id, NEW.subtotal, s.commission_rate,
      round(NEW.subtotal * s.commission_rate, 2),
      NEW.subtotal - round(NEW.subtotal * s.commission_rate, 2)
    from public.shops s where s.id = NEW.shop_id;
  end if;
  return NEW;
end;
$$;

create trigger auto_create_commission_trigger
after update on public.orders
for each row execute function public.auto_create_commission();

-- 35. Trigger: Auto-create rider incentive on delivery
create or replace function public.auto_create_rider_incentive()
returns trigger
language plpgsql
security definer
as $$
declare
  v_incentive record;
  v_assignment public.delivery_assignments%rowtype;
begin
  if NEW.status = 'delivered' and OLD.status = 'picked_up' then
    select * into v_assignment
    from public.delivery_assignments
    where order_id = NEW.id and status in ('accepted', 'picked_up')
    limit 1;

    if found then
      select * into v_incentive
      from public.calculate_rider_incentive(NEW.id, v_assignment.id);

      insert into public.rider_incentives (rider_id, delivery_assignment_id, order_id, margin_amount, incentive_rate, incentive_amount)
      values (v_assignment.rider_id, v_assignment.id, NEW.id, v_incentive.margin_amount, v_incentive.incentive_rate, v_incentive.incentive_amount);

      update public.riders
      set total_earnings = total_earnings + v_incentive.incentive_amount
      where id = v_assignment.rider_id;
    end if;
  end if;
  return NEW;
end;
$$;

create trigger auto_create_rider_incentive_trigger
after update on public.orders
for each row execute function public.auto_create_rider_incentive();

-- 36. Grant execute permissions on RPC functions
grant execute on function public.find_nearest_vendor to authenticated;
grant execute on function public.find_nearest_rider to authenticated;
grant execute on function public.calculate_commission to authenticated;
grant execute on function public.calculate_rider_incentive to authenticated;
grant execute on function public.auto_assign_rider to authenticated;
grant execute on function public.vendor_confirm_order to authenticated;
grant execute on function public.vendor_ready_for_pickup to authenticated;
grant execute on function public.rider_pickup_order to authenticated;
grant execute on function public.rider_deliver_order to authenticated;
grant execute on function public.admin_verify_payment to authenticated;
grant execute on function public.admin_process_vendor_payout to authenticated;
grant execute on function public.admin_process_rider_payout to authenticated;
grant execute on function public.admin_dashboard_metrics to authenticated;
grant execute on function public.search_nearby_products to authenticated;

-- 37. Enable realtime for key tables (for push notifications)
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.delivery_assignments;
alter publication supabase_realtime add table public.payments;
alter publication supabase_realtime add table public.vendor_notifications;
alter publication supabase_realtime add table public.rider_incentives;

-- 38. Comments for documentation
comment on table public.riders is 'Delivery riders with location tracking and incentive earnings';
comment on table public.delivery_assignments is 'Links orders to riders with full delivery lifecycle tracking';
comment on table public.payments is 'COD payment tracking with collection verification';
comment on table public.commissions is 'Platform commission per order with vendor payout tracking';
comment on table public.rider_incentives is 'Rider earnings (2% of margin) per delivery';
comment on table public.vendor_notifications is 'Push notification log for vendors';
comment on table public.vendor_products is 'Per-vendor pricing and stock for catalog products';
comment on table public.vendor_product_submissions is 'Vendor requests to add new catalog products';
comment on table public.audit_logs is 'Immutable audit trail for all critical operations';

comment on function public.find_nearest_vendor is 'Returns nearest vendors with product in stock, sorted by distance';
comment on function public.find_nearest_rider is 'Returns nearest available verified riders within radius';
comment on function public.calculate_commission is 'Calculates platform commission and vendor payout for an order';
comment on function public.calculate_rider_incentive is 'Calculates rider incentive (2% of order margin)';
comment on function public.auto_assign_rider is 'Automatically assigns nearest available rider to order';
comment on function public.vendor_confirm_order is 'Vendor confirms order, reserves stock, creates commission';
comment on function public.rider_deliver_order is 'Rider marks delivery complete, releases stock, creates incentive, records COD';
comment on function public.search_nearby_products is 'Searches products from nearby shops with distance and delivery estimates';

