-- Product taxonomy is real marketplace configuration, not demo inventory.
-- Safe to reapply: categories are keyed by their stable slug.
begin;

insert into public.categories (name, slug, sort_order, is_active)
values
  ('Tools', 'tools', 10, true),
  ('Fasteners', 'fasteners', 20, true),
  ('Plumbing', 'plumbing', 30, true),
  ('Electrical', 'electrical', 40, true),
  ('Paint & Supplies', 'paint-supplies', 50, true),
  ('Building Materials', 'building-materials', 60, true),
  ('Safety', 'safety', 70, true),
  ('Bathroom', 'bathroom', 80, true),
  ('Locks & Security', 'locks-security', 90, true),
  ('Gardening', 'gardening', 100, true)
on conflict (slug) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  parent_id = null,
  is_active = true;

insert into public.categories (name, slug, parent_id, sort_order, is_active)
select child.name, child.slug, parent.id, child.sort_order, true
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
) as child(name, slug, parent_slug, sort_order)
join public.categories parent on parent.slug = child.parent_slug
on conflict (slug) do update set
  name = excluded.name,
  parent_id = excluded.parent_id,
  sort_order = excluded.sort_order,
  is_active = true;

commit;
