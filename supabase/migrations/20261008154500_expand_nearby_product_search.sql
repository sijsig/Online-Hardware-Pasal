-- Let product search match names, brands, models, and whole category branches.
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
  with recursive category_matches(id) as (
    select c.id
    from public.categories c
    where c.is_active and p_query is not null
      and (c.name ilike '%' || p_query || '%' or c.slug ilike '%' || p_query || '%')
    union
    select child.id
    from public.categories child
    join category_matches parent on child.parent_id = parent.id
    where child.is_active
  )
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
    and (
      p_query is null
      or p.name ilike '%' || p_query || '%'
      or coalesce(p.brand, '') ilike '%' || p_query || '%'
      or coalesce(p.model, '') ilike '%' || p_query || '%'
      or exists (select 1 from category_matches matched where matched.id = p.category_id)
    )
    and extensions.st_dwithin(
      v.location,
      extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
      least(greatest(1, least(coalesce(p_radius_meters, 10000), 100000)), v.delivery_radius_meters)
    )
  order by (vp.stock_quantity > vp.reserved_quantity) desc,
    9, v.estimated_delivery_minutes, vp.price
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;
