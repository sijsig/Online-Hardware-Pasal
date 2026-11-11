create or replace function public.vendor_upsert_inventory(
  p_vendor_id uuid,
  p_product_id uuid,
  p_price numeric,
  p_stock_quantity integer,
  p_is_active boolean default true,
  p_vendor_sku text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inventory_id uuid;
  v_sku text := nullif(left(trim(p_vendor_sku), 100), '');
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not public.can_manage_vendor_inventory(p_vendor_id) then
    raise exception 'Not allowed to manage this shop inventory' using errcode = '42501';
  end if;
  if p_product_id is null or p_price is null or p_price <= 0 or p_price > 1000000000 then
    raise exception 'Enter a valid product price' using errcode = '22023';
  end if;
  if p_stock_quantity is null or p_stock_quantity < 0 or p_stock_quantity > 1000000 then
    raise exception 'Enter a valid stock quantity' using errcode = '22023';
  end if;
  if p_is_active is null then
    raise exception 'Availability is required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.products p where p.id = p_product_id and p.is_active) then
    raise exception 'This catalog product is unavailable' using errcode = 'P0002';
  end if;

  insert into public.vendor_products (vendor_id, product_id, vendor_sku, price, stock_quantity, is_active)
  values (p_vendor_id, p_product_id, v_sku, p_price, p_stock_quantity, p_is_active)
  on conflict (vendor_id, product_id) do update
  set vendor_sku = excluded.vendor_sku,
      price = excluded.price,
      stock_quantity = excluded.stock_quantity,
      is_active = excluded.is_active
  where public.vendor_products.reserved_quantity <= excluded.stock_quantity
  returning id into v_inventory_id;

  if v_inventory_id is null then
    raise exception 'Stock cannot be lower than units reserved for current orders' using errcode = 'P0001';
  end if;
  return v_inventory_id;
end;
$$;

revoke all on function public.vendor_upsert_inventory(uuid, uuid, numeric, integer, boolean, text) from public, anon;
grant execute on function public.vendor_upsert_inventory(uuid, uuid, numeric, integer, boolean, text) to authenticated;
