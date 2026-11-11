-- Comprehensive Test Data for Admin Panel Testing
-- Run this after migrations are applied (supabase db reset or supabase db push)
-- This creates: admin users, shops, riders, products, orders, delivery assignments

begin;

-- ============================================================
-- 1. Create test users in auth.users and profiles
-- Note: In production, users would sign up normally.
-- Here we create profiles directly; you'll need to create
-- corresponding auth.users via Supabase Dashboard or API.
-- ============================================================

-- Admin user (you need to create auth user manually with email admin@test.com)
-- For now, we'll create a profile that will link when auth user is created
-- Use these emails when creating auth users in Supabase Dashboard:
-- admin@test.com, shop1@test.com, shop2@test.com, rider1@test.com, rider2@test.com, customer@test.com

insert into public.profiles (id, email, full_name, role, phone, created_at) values
  -- Admin users
  (gen_random_uuid(), 'admin@test.com', 'Admin User', 'super_admin', '9800000000', now() - interval '30 days'),
  (gen_random_uuid(), 'admin2@test.com', 'Admin Two', 'admin', '9800000001', now() - interval '20 days'),
  -- Vendor users (shops)
  (gen_random_uuid(), 'shop1@test.com', 'Kathmandu Hardware', 'vendor', '9801000001', now() - interval '60 days'),
  (gen_random_uuid(), 'shop2@test.com', 'Lalitpur Supply Co', 'vendor', '9801000002', now() - interval '45 days'),
  (gen_random_uuid(), 'shop3@test.com', 'Bhaktapur Tools', 'vendor', '9801000003', now() - interval '30 days'),
  -- Rider users
  (gen_random_uuid(), 'rider1@test.com', 'Ram Bahadur', 'rider', '9802000001', now() - interval '30 days'),
  (gen_random_uuid(), 'rider2@test.com', 'Sita Devi', 'rider', '9802000002', now() - interval '15 days'),
  -- Customer users
  (gen_random_uuid(), 'customer1@test.com', 'John Customer', 'customer', '9803000001', now() - interval '10 days'),
  (gen_random_uuid(), 'customer2@test.com', 'Jane Customer', 'customer', '9803000002', now() - interval '5 days')
on conflict (email) do nothing;

-- Store vendor IDs for later reference
-- We'll use CTEs to get the IDs

-- ============================================================
-- 2. Create Shops (Vendors) with locations
-- ============================================================

with vendor_profiles as (
  select id from public.profiles where email in ('shop1@test.com', 'shop2@test.com', 'shop3@test.com')
)
insert into public.vendors (
  id, name, slug, description, phone, email,
  address_line, city, district, province,
  location, delivery_radius_meters, estimated_delivery_minutes,
  base_delivery_fee, commission_rate, status, is_demo,
  owner_id, created_at
)
select 
  p.id,
  case 
    when p.email = 'shop1@test.com' then 'Kathmandu Hardware Store'
    when p.email = 'shop2@test.com' then 'Lalitpur Supply Co'
    else 'Bhaktapur Tools & Hardware'
  end,
  case 
    when p.email = 'shop1@test.com' then 'kathmandu-hardware-store'
    when p.email = 'shop2@test.com' then 'lalitpur-supply-co'
    else 'bhaktapur-tools'
  end,
  case 
    when p.email = 'shop1@test.com' then 'Complete hardware solutions in Kathmandu valley'
    when p.email = 'shop2@test.com' then 'Quality plumbing and electrical supplies'
    else 'Specialized in power tools and construction materials'
  end,
  p.phone,
  p.email,
  case 
    when p.email = 'shop1@test.com' then 'New Road, Kathmandu'
    when p.email = 'shop2@test.com' then 'Pulchowk, Lalitpur'
    else 'Suryabinayak, Bhaktapur'
  end,
  case 
    when p.email = 'shop1@test.com' then 'Kathmandu'
    when p.email = 'shop2@test.com' then 'Lalitpur'
    else 'Bhaktapur'
  end,
  'Kathmandu',
  'Bagmati',
  extensions.st_setsrid(
    extensions.st_makepoint(
      case when p.email = 'shop1@test.com' then 85.3140
           when p.email = 'shop2@test.com' then 85.3240
           else 85.4320 end,
      case when p.email = 'shop1@test.com' then 27.7040
           when p.email = 'shop2@test.com' then 27.6760
           else 27.6720 end
    ), 4326
  )::extensions.geography,
  10000,
  case when p.email = 'shop1@test.com' then 45
       when p.email = 'shop2@test.com' then 50
       else 55 end,
  case when p.email = 'shop1@test.com' then 100
       when p.email = 'shop2@test.com' then 120
       else 150 end,
  0.10000,
  'active',
  false,
  p.id,
  now() - interval '30 days'
from vendor_profiles p
on conflict (id) do update set
  status = excluded.status,
  updated_at = now();

-- ============================================================
-- 3. Create Riders with locations and status
-- ============================================================

with rider_profiles as (
  select id from public.profiles where email in ('rider1@test.com', 'rider2@test.com')
)
insert into public.riders (
  id, user_id, name, phone, vehicle_type, vehicle_number,
  license_number, status, current_location, rating,
  total_deliveries, is_available, created_at
)
select
  p.id,
  p.id,
  case when p.email = 'rider1@test.com' then 'Ram Bahadur' else 'Sita Devi' end,
  p.phone,
  'motorcycle',
  case when p.email = 'rider1@test.com' then 'Ba 1 Cha 1234' else 'Ba 1 Cha 5678' end,
  case when p.email = 'rider1@test.com' then 'DL-2024-001' else 'DL-2024-002' end,
  'active',
  extensions.st_setsrid(
    extensions.st_makepoint(
      case when p.email = 'rider1@test.com' then 85.3100 else 85.3300 end,
      case when p.email = 'rider1@test.com' then 27.7000 else 27.6800 end
    ), 4326
  )::extensions.geography,
  4.5 + random() * 0.5,
  floor(random() * 100 + 50)::int,
  true,
  now() - interval '30 days'
from rider_profiles p
on conflict (id) do update set
  status = excluded.status,
  updated_at = now();

-- ============================================================
-- 4. Create Products (using existing categories)
-- ============================================================

-- Get category IDs
with categories as (
  select id, slug from public.categories where slug in (
    'drill-machines', 'hammers', 'screwdrivers', 'pipes', 
    'wires', 'nails', 'hand-tools', 'power-tools'
  )
)
insert into public.products (
  id, name, slug, description, category_id, brand, model, unit,
  is_active, created_at
)
select
  gen_random_uuid(),
  case 
    when c.slug = 'drill-machines' then '13mm Cordless Drill Machine'
    when c.slug = 'hammers' then 'Claw Hammer 500g'
    when c.slug = 'screwdrivers' then 'Screwdriver Set 12pcs'
    when c.slug = 'pipes' then 'PVC Pipe 1 inch x 3m'
    when c.slug = 'wires' then 'Electrical Wire 2.5mm² (Red)'
    when c.slug = 'nails' then 'Concrete Nails 2 inch (1kg pack)'
    when c.slug = 'hand-tools' then 'Adjustable Wrench 10 inch'
    else 'Angle Grinder 4 inch'
  end,
  case 
    when c.slug = 'drill-machines' then '13mm-cordless-drill-machine'
    when c.slug = 'hammers' then 'claw-hammer-500g'
    when c.slug = 'screwdrivers' then 'screwdriver-set-12pcs'
    when c.slug = 'pipes' then 'pvc-pipe-1-inch-3m'
    when c.slug = 'wires' then 'electrical-wire-25mm-red'
    when c.slug = 'nails' then 'concrete-nails-2inch-1kg'
    when c.slug = 'hand-tools' then 'adjustable-wrench-10inch'
    else 'angle-grinder-4inch'
  end,
  'High quality ' || lower(case 
    when c.slug = 'drill-machines' then '13mm Cordless Drill Machine'
    when c.slug = 'hammers' then 'Claw Hammer 500g'
    when c.slug = 'screwdrivers' then 'Screwdriver Set 12pcs'
    when c.slug = 'pipes' then 'PVC Pipe 1 inch x 3m'
    when c.slug = 'wires' then 'Electrical Wire 2.5mm² (Red)'
    when c.slug = 'nails' then 'Concrete Nails 2 inch (1kg pack)'
    when c.slug = 'hand-tools' then 'Adjustable Wrench 10 inch'
    else 'Angle Grinder 4 inch'
  end) || ' for professional use',
  c.id,
  case 
    when c.slug in ('drill-machines', 'power-tools') then 'Bosch'
    when c.slug = 'hammers' then 'Stanley'
    when c.slug = 'screwdrivers' then 'Taparia'
    when c.slug = 'pipes' then 'Prince'
    when c.slug = 'wires' then 'Finolex'
    when c.slug = 'nails' then 'Local'
    else 'Ingco'
  end,
  case 
    when c.slug = 'drill-machines' then 'GSR 12V-15'
    when c.slug = 'hammers' then 'STHT51512'
    when c.slug = 'screwdrivers' then 'TS-12'
    when c.slug = 'pipes' then 'PVC-25'
    when c.slug = 'wires' then 'FR-2.5'
    when c.slug = 'nails' then 'CN-50'
    when c.slug = 'hand-tools' then 'AW-250'
    else 'AG-100'
  end,
  case 
    when c.slug in ('drill-machines', 'hammers', 'screwdrivers', 'hand-tools', 'power-tools') then 'each'
    when c.slug = 'pipes' then 'length'
    when c.slug = 'wires' then 'meter'
    else 'pack'
  end,
  true,
  now() - interval '10 days'
from categories c
on conflict (slug) do update set
  name = excluded.name,
  updated_at = now();

-- ============================================================
-- 5. Create Vendor Products (Shop inventory with prices)
-- ============================================================

with vendor_data as (
  select v.id as vendor_id, v.name as vendor_name
  from public.vendors v
  join public.profiles p on p.id = v.owner_id
  where v.status = 'active'
),
product_data as (
  select id, slug from public.products where slug in (
    '13mm-cordless-drill-machine', 'claw-hammer-500g', 'screwdriver-set-12pcs',
    'pvc-pipe-1-inch-3m', 'electrical-wire-25mm-red', 'concrete-nails-2inch-1kg',
    'adjustable-wrench-10inch', 'angle-grinder-4inch'
  )
)
insert into public.vendor_products (vendor_id, product_id, vendor_sku, price, stock_quantity, is_active)
select
  v.vendor_id,
  p.id,
  v.vendor_name || '-' || p.slug,
  case 
    when p.slug = '13mm-cordless-drill-machine' then 8500 + (random() * 500)::int
    when p.slug = 'claw-hammer-500g' then 950 + (random() * 100)::int
    when p.slug = 'screwdriver-set-12pcs' then 1350 + (random() * 200)::int
    when p.slug = 'pvc-pipe-1-inch-3m' then 450 + (random() * 50)::int
    when p.slug = 'electrical-wire-25mm-red' then 125 + (random() * 20)::int
    when p.slug = 'concrete-nails-2inch-1kg' then 200 + (random() * 30)::int
    when p.slug = 'adjustable-wrench-10inch' then 650 + (random() * 80)::int
    else 7200 + (random() * 800)::int
  end,
  case 
    when p.slug in ('13mm-cordless-drill-machine', 'angle-grinder-4inch') then floor(random() * 5 + 3)
    when p.slug in ('claw-hammer-500g', 'screwdriver-set-12pcs', 'adjustable-wrench-10inch') then floor(random() * 20 + 10)
    else floor(random() * 50 + 20)
  end,
  true
from vendor_data v
cross join product_data p
on conflict (vendor_id, product_id) do update set
  price = excluded.price,
  stock_quantity = excluded.stock_quantity,
  updated_at = now();

-- ============================================================
-- 6. Create Customer Addresses
-- ============================================================

with customer_profiles as (
  select id from public.profiles where email in ('customer1@test.com', 'customer2@test.com')
)
insert into public.customer_addresses (id, user_id, label, address_line, city, district, province, location, is_default)
select
  gen_random_uuid(),
  p.id,
  'Home',
  case when p.email = 'customer1@test.com' then 'Baluwatar, Kathmandu' else 'Jhamsikhel, Lalitpur' end,
  case when p.email = 'customer1@test.com' then 'Kathmandu' else 'Lalitpur' end,
  'Kathmandu',
  'Bagmati',
  extensions.st_setsrid(
    extensions.st_makepoint(
      case when p.email = 'customer1@test.com' then 85.3200 else 85.3250 end,
      case when p.email = 'customer1@test.com' then 27.7200 else 27.6850 end
    ), 4326
  )::extensions.geography,
  true
from customer_profiles p
on conflict do nothing;

-- ============================================================
-- 7. Create Orders (various statuses)
-- ============================================================

with customer_profiles as (
  select id from public.profiles where email in ('customer1@test.com', 'customer2@test.com')
),
vendor_data as (
  select v.id as vendor_id, vp.product_id, vp.price, vp.vendor_sku
  from public.vendors v
  join public.vendor_products vp on vp.vendor_id = v.id
  where v.status = 'active' and vp.is_active
),
customer_addresses as (
  select ca.id as address_id, ca.user_id
  from public.customer_addresses ca
)
insert into public.orders (
  id, customer_id, shop_id, address_id, status, subtotal, delivery_fee, 
  discount, tax, total, payment_method, payment_status, 
  customer_lat, customer_lng, created_at, updated_at
)
select
  gen_random_uuid(),
  cp.id,
  vd.vendor_id,
  ca.address_id,
  case 
    when rn = 1 then 'delivered'
    when rn = 2 then 'shipped'
    when rn = 3 then 'confirmed'
    when rn = 4 then 'preparing'
    when rn = 5 then 'pending'
    when rn = 6 then 'cancelled'
    else 'pending'
  end,
  vd.price * qty,
  case vd.vendor_id 
    when (select id from public.vendors where slug = 'kathmandu-hardware-store') then 100
    when (select id from public.vendors where slug = 'lalitpur-supply-co') then 120
    else 150
  end,
  0,
  (vd.price * qty) * 0.13,
  (vd.price * qty) + 
    case vd.vendor_id 
      when (select id from public.vendors where slug = 'kathmandu-hardware-store') then 100
      when (select id from public.vendors where slug = 'lalitpur-supply-co') then 120
      else 150
    end + 
    (vd.price * qty) * 0.13,
  case when rn % 3 = 0 then 'cod' else 'online' end,
  case when rn % 3 = 0 then 'pending' else 'completed' end,
  27.7040 + (random() - 0.5) * 0.02,
  85.3140 + (random() - 0.5) * 0.02,
  now() - interval '1 day' * rn,
  now() - interval '1 day' * rn + interval '2 hours'
from (
  select cp.id, vd.*, ca.address_id, row_number() over (partition by cp.id order by vd.product_id) as rn,
    case 
      when row_number() over (partition by cp.id order by vd.product_id) in (1,2,3) then 2
      when row_number() over (partition by cp.id order by vd.product_id) in (4,5) then 1
      else 3
    end as qty
  from customer_profiles cp
  cross join vendor_data vd
  cross join customer_addresses ca
  where ca.user_id = cp.id
) t
where rn <= 12  -- 6 orders per customer
on conflict do nothing;

-- ============================================================
-- 8. Create Order Items
-- ============================================================

with order_data as (
  select o.id as order_id, vd.product_id, vd.price,
    case 
      when row_number() over (partition by o.id order by vd.product_id) in (1,2,3) then 2
      when row_number() over (partition by o.id order by vd.product_id) in (4,5) then 1
      else 3
    end as quantity
  from public.orders o
  join public.vendors v on v.id = o.shop_id
  join public.vendor_products vp on vp.vendor_id = v.id
  join (
    select id, product_id from public.products 
    where slug in ('13mm-cordless-drill-machine', 'claw-hammer-500g', 'screwdriver-set-12pcs',
      'pvc-pipe-1-inch-3m', 'electrical-wire-25mm-red', 'concrete-nails-2inch-1kg',
      'adjustable-wrench-10inch', 'angle-grinder-4inch')
  ) pd on pd.id = vp.product_id
  join public.vendor_products vd on vd.vendor_id = v.id and vd.product_id = pd.id
  where o.status != 'cancelled'
  limit 20
)
insert into public.order_items (id, order_id, product_id, vendor_product_id, quantity, unit_price, total_price)
select
  gen_random_uuid(),
  od.order_id,
  od.product_id,
  (select id from public.vendor_products where vendor_id = (select shop_id from public.orders where id = od.order_id) and product_id = od.product_id limit 1),
  od.quantity,
  od.price,
  od.price * od.quantity
from order_data od
on conflict do nothing;

-- ============================================================
-- 9. Create Delivery Assignments
-- ============================================================

with orders_data as (
  select o.id as order_id, r.id as rider_id
  from public.orders o
  cross join (
    select id from public.riders where status = 'active'
  ) r
  where o.status in ('confirmed', 'preparing', 'shipped', 'out_for_delivery', 'delivered')
  order by o.created_at
)
insert into public.delivery_assignments (id, order_id, rider_id, status, assigned_at, picked_up_at, delivered_at)
select
  gen_random_uuid(),
  od.order_id,
  od.rider_id,
  case 
    when o.status = 'delivered' then 'delivered'
    when o.status = 'shipped' then 'picked_up'
    when o.status = 'out_for_delivery' then 'out_for_delivery'
    when o.status = 'confirmed' then 'assigned'
    else 'assigned'
  end,
  o.created_at + interval '30 minutes',
  case when o.status in ('shipped', 'out_for_delivery', 'delivered') then o.created_at + interval '1 hour' else null end,
  case when o.status = 'delivered' then o.created_at + interval '2 hours' else null end
from orders_data od
join public.orders o on o.id = od.order_id
on conflict do nothing;

-- ============================================================
-- 10. Create Order Status History (for timeline)
-- ============================================================

with orders_data as (
  select id, status, created_at from public.orders
)
insert into public.order_status_history (id, order_id, status, note, created_at)
select
  gen_random_uuid(),
  o.id,
  o.status,
  case o.status
    when 'pending' then 'Order placed'
    when 'confirmed' then 'Order confirmed by shop'
    when 'preparing' then 'Items being prepared'
    when 'shipped' then 'Handed to rider'
    when 'out_for_delivery' then 'Out for delivery'
    when 'delivered' then 'Delivered to customer'
    when 'cancelled' then 'Order cancelled'
    else 'Status updated'
  end,
  o.created_at + interval '1 minute'
from orders_data o
on conflict do nothing;

-- Add additional status history for orders that progressed
with orders_data as (
  select o.id, o.status, o.created_at, o.updated_at
  from public.orders o
  where o.status in ('confirmed', 'preparing', 'shipped', 'out_for_delivery', 'delivered')
)
insert into public.order_status_history (id, order_id, status, note, created_at)
select
  gen_random_uuid(),
  o.id,
  'confirmed',
  'Order confirmed by shop',
  o.created_at + interval '15 minutes'
from orders_data o
where o.status in ('confirmed', 'preparing', 'shipped', 'out_for_delivery', 'delivered')
on conflict do nothing;

with orders_data as (
  select o.id, o.status, o.created_at, o.updated_at
  from public.orders o
  where o.status in ('preparing', 'shipped', 'out_for_delivery', 'delivered')
)
insert into public.order_status_history (id, order_id, status, note, created_at)
select
  gen_random_uuid(),
  o.id,
  'preparing',
  'Items being prepared and packed',
  o.created_at + interval '30 minutes'
from orders_data o
where o.status in ('preparing', 'shipped', 'out_for_delivery', 'delivered')
on conflict do nothing;

with orders_data as (
  select o.id, o.status, o.created_at, o.updated_at
  from public.orders o
  where o.status in ('shipped', 'out_for_delivery', 'delivered')
)
insert into public.order_status_history (id, order_id, status, note, created_at)
select
  gen_random_uuid(),
  o.id,
  'shipped',
  'Order handed to rider for delivery',
  o.created_at + interval '1 hour'
from orders_data o
where o.status in ('shipped', 'out_for_delivery', 'delivered')
on conflict do nothing;

with orders_data as (
  select o.id, o.status, o.created_at, o.updated_at
  from public.orders o
  where o.status in ('out_for_delivery', 'delivered')
)
insert into public.order_status_history (id, order_id, status, note, created_at)
select
  gen_random_uuid(),
  o.id,
  'out_for_delivery',
  'Rider is on the way to customer',
  o.created_at + interval '90 minutes'
from orders_data o
where o.status in ('out_for_delivery', 'delivered')
on conflict do nothing;

with orders_data as (
  select o.id, o.status, o.created_at, o.updated_at
  from public.orders o
  where o.status = 'delivered'
)
insert into public.order_status_history (id, order_id, status, note, created_at)
select
  gen_random_uuid(),
  o.id,
  'delivered',
  'Order delivered successfully',
  o.updated_at
from orders_data o
on conflict do nothing;

commit;

-- ============================================================
-- Summary of created test data:
-- - 2 Admin users (super_admin, admin)
-- - 3 Vendors/Shops (active)
-- - 2 Riders (active)
-- - 2 Customers
-- - 8 Products with vendor inventory
-- - 12 Orders (various statuses: pending, confirmed, preparing, shipped, out_for_delivery, delivered, cancelled)
-- - Order items, delivery assignments, status history
-- - Customer addresses
-- ============================================================
