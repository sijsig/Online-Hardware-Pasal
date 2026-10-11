-- Local-development demo catalog only. Supabase does not apply seed.sql with db push.
-- All synthetic vendors are explicitly marked is_demo and no auth.users are created.
begin;

insert into public.categories (name, slug, sort_order) values
  ('Tools', 'tools', 10),
  ('Fasteners', 'fasteners', 20),
  ('Plumbing', 'plumbing', 30),
  ('Electrical', 'electrical', 40),
  ('Paint & Supplies', 'paint-supplies', 50),
  ('Building Materials', 'building-materials', 60),
  ('Safety', 'safety', 70),
  ('Bathroom', 'bathroom', 80),
  ('Locks & Security', 'locks-security', 90),
  ('Gardening', 'gardening', 100)
on conflict (slug) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  parent_id = null,
  is_active = true;

insert into public.categories (name, slug, parent_id, sort_order)
select seed.name, seed.slug, parent.id, seed.sort_order
from (values
  ('Hand Tools', 'hand-tools', 'tools', 10),
  ('Power Tools', 'power-tools', 'tools', 20),
  ('Tool Accessories', 'tool-accessories', 'tools', 30),
  ('Hammers', 'hammers', 'hand-tools', 10),
  ('Screwdrivers', 'screwdrivers', 'hand-tools', 20),
  ('Pliers', 'pliers', 'hand-tools', 30),
  ('Wrenches', 'wrenches', 'hand-tools', 40),
  ('Chisels', 'chisels', 'hand-tools', 50),
  ('Hand Saws', 'hand-saws', 'hand-tools', 60),
  ('Drill Machines', 'drill-machines', 'power-tools', 10),
  ('Angle Grinders', 'angle-grinders', 'power-tools', 20),
  ('Circular Saws', 'circular-saws', 'power-tools', 30),
  ('Sanders', 'sanders', 'power-tools', 40),
  ('Nuts', 'nuts', 'fasteners', 10),
  ('Bolts', 'bolts', 'fasteners', 20),
  ('Washers', 'washers', 'fasteners', 30),
  ('Screws', 'screws', 'fasteners', 40),
  ('Nails', 'nails', 'fasteners', 50),
  ('Rivets', 'rivets', 'fasteners', 60),
  ('Staples', 'staples', 'fasteners', 70),
  ('Anchors', 'anchors', 'fasteners', 80),
  ('Pipes', 'pipes', 'plumbing', 10),
  ('Pipe Fittings', 'pipe-fittings', 'plumbing', 20),
  ('Valves', 'valves', 'plumbing', 30),
  ('Taps', 'taps', 'plumbing', 40),
  ('Water Tanks', 'water-tanks', 'plumbing', 50),
  ('Plumbing Accessories', 'plumbing-accessories', 'plumbing', 60),
  ('Wires', 'wires', 'electrical', 10),
  ('Cables', 'cables', 'electrical', 20),
  ('Switches', 'switches', 'electrical', 30),
  ('Sockets', 'sockets', 'electrical', 40),
  ('MCBs', 'mcbs', 'electrical', 50),
  ('Distribution Boards', 'distribution-boards', 'electrical', 60),
  ('Electrical Accessories', 'electrical-accessories', 'electrical', 70)
) as seed(name, slug, parent_slug, sort_order)
join public.categories parent on parent.slug = seed.parent_slug
on conflict (slug) do update set
  name = excluded.name,
  parent_id = excluded.parent_id,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.products (name, slug, description, category_id, brand, model, unit)
select seed.name, seed.slug, seed.description, category.id, seed.brand, seed.model, seed.unit
from (values
  ('Demo 13mm Drill Machine', 'demo-13mm-drill-machine', 'Demo catalog item for local testing.', 'drill-machines', 'Demo Brand', 'D-13', 'each'),
  ('Demo Claw Hammer 500g', 'demo-claw-hammer-500g', 'Demo catalog item for local testing.', 'hammers', 'Demo Brand', 'H-500', 'each'),
  ('Demo Screwdriver Set', 'demo-screwdriver-set', 'Demo catalog item for local testing.', 'screwdrivers', 'Demo Brand', 'S-SET', 'set'),
  ('Demo PVC Pipe 1 inch', 'demo-pvc-pipe-1-inch', 'Demo catalog item for local testing.', 'pipes', 'Demo Brand', 'P-1', 'length'),
  ('Demo Electrical Wire 2.5mm', 'demo-electrical-wire-25mm', 'Demo catalog item for local testing.', 'wires', 'Demo Brand', 'W-25', 'meter'),
  ('Demo Concrete Nails 2 inch', 'demo-concrete-nails-2-inch', 'Demo catalog item for local testing.', 'nails', 'Demo Brand', 'N-2', 'pack')
) as seed(name, slug, description, category_slug, brand, model, unit)
join public.categories category on category.slug = seed.category_slug
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  unit = excluded.unit,
  is_active = true;

insert into public.vendors (
  name, slug, description, phone, address_line, city, district, province,
  location, delivery_radius_meters, estimated_delivery_minutes,
  base_delivery_fee, commission_rate, status, is_demo
) values
  (
    'DEMO — Kathmandu Hardware', 'demo-kathmandu-hardware', 'Synthetic local-development shop.',
    '9800000001', 'Demo address, New Road', 'Kathmandu', 'Kathmandu', 'Bagmati',
    extensions.st_setsrid(extensions.st_makepoint(85.3140, 27.7040), 4326)::extensions.geography,
    8000, 45, 100, 0.10000, 'active', true
  ),
  (
    'DEMO — Lalitpur Supply', 'demo-lalitpur-supply', 'Synthetic local-development shop.',
    '9800000002', 'Demo address, Pulchowk', 'Lalitpur', 'Lalitpur', 'Bagmati',
    extensions.st_setsrid(extensions.st_makepoint(85.3240, 27.6760), 4326)::extensions.geography,
    8000, 55, 120, 0.10000, 'active', true
  )
on conflict (slug) do nothing;

insert into public.vendor_products (vendor_id, product_id, vendor_sku, price, stock_quantity, is_active)
select vendor.id, product.id, seed.vendor_sku, seed.price, seed.stock_quantity, true
from (values
  ('demo-kathmandu-hardware', 'demo-13mm-drill-machine', 'DEMO-DRILL-01', 7500.00::numeric, 4),
  ('demo-lalitpur-supply', 'demo-13mm-drill-machine', 'DEMO-DRILL-02', 7300.00::numeric, 2),
  ('demo-kathmandu-hardware', 'demo-claw-hammer-500g', 'DEMO-HAMMER-01', 850.00::numeric, 12),
  ('demo-lalitpur-supply', 'demo-screwdriver-set', 'DEMO-SCREW-01', 1250.00::numeric, 7),
  ('demo-kathmandu-hardware', 'demo-pvc-pipe-1-inch', 'DEMO-PIPE-01', 420.00::numeric, 20),
  ('demo-lalitpur-supply', 'demo-electrical-wire-25mm', 'DEMO-WIRE-01', 115.00::numeric, 50),
  ('demo-kathmandu-hardware', 'demo-concrete-nails-2-inch', 'DEMO-NAILS-01', 180.00::numeric, 0)
) as seed(vendor_slug, product_slug, vendor_sku, price, stock_quantity)
join public.vendors vendor on vendor.slug = seed.vendor_slug and vendor.is_demo
join public.products product on product.slug = seed.product_slug
on conflict (vendor_id, product_id) do nothing;

commit;
