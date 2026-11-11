-- Vendor product requests stay private until an administrator approves them.
create table public.vendor_product_submissions (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  product_name text not null check (char_length(trim(product_name)) between 2 and 160),
  brand text check (brand is null or char_length(brand) <= 100),
  model text check (model is null or char_length(model) <= 100),
  unit text not null default 'each' check (char_length(trim(unit)) between 1 and 32),
  price numeric(12,2) not null check (price > 0),
  stock_quantity integer not null check (stock_quantity >= 0 and stock_quantity <= 1000000),
  vendor_sku text check (vendor_sku is null or char_length(vendor_sku) <= 100),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index vendor_product_submissions_vendor_created_idx
  on public.vendor_product_submissions(vendor_id, created_at desc);
create index vendor_product_submissions_pending_idx
  on public.vendor_product_submissions(created_at) where status = 'pending';

alter table public.vendor_products
  add column approval_status text not null default 'approved'
  check (approval_status in ('pending', 'approved', 'rejected'));

alter table public.vendor_product_submissions enable row level security;

create policy vendor_product_submissions_member_read
  on public.vendor_product_submissions for select to authenticated
  using ((select public.is_vendor_member(vendor_id)) or (select public.is_admin()));

grant select on public.vendor_product_submissions to authenticated;

drop policy vendor_products_read_active on public.vendor_products;
create policy vendor_products_read_active on public.vendor_products for select to anon, authenticated
  using (is_active and approval_status = 'approved' and exists (
    select 1 from public.vendors v where v.id = vendor_id and v.status = 'active'
  ));

-- Listings are created through a submission, so vendor clients cannot skip review.
drop policy vendor_products_member_insert on public.vendor_products;
revoke insert on public.vendor_products from authenticated;
alter table public.vendor_products alter column approval_status set default 'pending';

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
  if p_price is null or p_price <= 0 or p_price > 1000000000 then
    raise exception 'Enter a valid product price' using errcode = '22023';
  end if;
  if p_stock_quantity is null or p_stock_quantity < 0 or p_stock_quantity > 1000000 then
    raise exception 'Enter a valid stock quantity' using errcode = '22023';
  end if;
  if p_is_active is null then
    raise exception 'Availability is required' using errcode = '22023';
  end if;

  update public.vendor_products vp
  set vendor_sku = v_sku, price = p_price, stock_quantity = p_stock_quantity,
      is_active = p_is_active, updated_at = now()
  where vp.vendor_id = p_vendor_id and vp.product_id = p_product_id
    and vp.approval_status = 'approved'
    and vp.reserved_quantity <= p_stock_quantity
  returning vp.id into v_inventory_id;

  if v_inventory_id is null then
    if exists (select 1 from public.vendor_products vp where vp.vendor_id = p_vendor_id and vp.product_id = p_product_id) then
      raise exception 'Only approved listings can be edited here, and stock cannot go below reserved units' using errcode = 'P0001';
    end if;
    raise exception 'New product listings must be submitted for administrator approval' using errcode = '22023';
  end if;
  return v_inventory_id;
end;
$$;

create or replace function public.submit_vendor_product(
  p_vendor_id uuid,
  p_product_id uuid default null,
  p_product_name text default null,
  p_category_id uuid default null,
  p_brand text default null,
  p_model text default null,
  p_unit text default 'each',
  p_price numeric default null,
  p_stock_quantity integer default null,
  p_vendor_sku text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_vendor_status public.vendor_status;
  v_name text;
  v_brand text := nullif(left(trim(p_brand), 100), '');
  v_model text := nullif(left(trim(p_model), 100), '');
  v_unit text := coalesce(nullif(left(trim(p_unit), 32), ''), 'each');
  v_submission_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not public.can_manage_vendor_inventory(p_vendor_id) then
    raise exception 'Not allowed to manage this shop inventory' using errcode = '42501';
  end if;
  select status into v_vendor_status from public.vendors where id = p_vendor_id;
  if v_vendor_status <> 'active' then raise exception 'Only approved active shops can submit products' using errcode = '22023'; end if;
  if p_price is null or p_price <= 0 or p_price > 1000000000 then raise exception 'Enter a valid product price' using errcode = '22023'; end if;
  if p_stock_quantity is null or p_stock_quantity < 0 or p_stock_quantity > 1000000 then raise exception 'Enter a valid stock quantity' using errcode = '22023'; end if;
  if nullif(trim(p_vendor_sku), '') is not null and char_length(trim(p_vendor_sku)) > 100 then raise exception 'Shop SKU is too long' using errcode = '22023'; end if;

  if p_product_id is not null then
    select name, brand, model, unit into v_name, v_brand, v_model, v_unit
    from public.products where id = p_product_id and is_active;
    if not found then raise exception 'This catalog product is unavailable' using errcode = 'P0002'; end if;
    if exists (select 1 from public.vendor_products where vendor_id = p_vendor_id and product_id = p_product_id and approval_status = 'approved') then
      raise exception 'This product is already approved for your shop. Edit it from inventory.' using errcode = '22023';
    end if;
  else
    v_name := nullif(trim(p_product_name), '');
    if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 160 then
      raise exception 'Product name must be between 2 and 160 characters' using errcode = '22023';
    end if;
    if p_category_id is null or not exists (select 1 from public.categories where id = p_category_id and is_active) then
      raise exception 'Choose an active product category' using errcode = '22023';
    end if;
  end if;

  insert into public.vendor_product_submissions (
    vendor_id, product_id, category_id, product_name, brand, model, unit,
    price, stock_quantity, vendor_sku, submitted_by
  ) values (
    p_vendor_id, p_product_id, case when p_product_id is null then p_category_id else null end,
    v_name, v_brand, v_model, v_unit, p_price, p_stock_quantity,
    nullif(left(trim(p_vendor_sku), 100), ''), v_user_id
  ) returning id into v_submission_id;
  return v_submission_id;
end;
$$;

create or replace function public.admin_review_vendor_product(
  p_submission_id uuid,
  p_approve boolean,
  p_admin_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.vendor_product_submissions%rowtype;
  v_product_id uuid;
  v_slug text;
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_approve is null then raise exception 'Choose approve or reject' using errcode = '22023'; end if;
  select * into v_submission from public.vendor_product_submissions where id = p_submission_id for update;
  if not found then raise exception 'Product submission not found' using errcode = 'P0002'; end if;
  if v_submission.status <> 'pending' then raise exception 'This product submission has already been reviewed' using errcode = '22023'; end if;

  if not p_approve then
    update public.vendor_product_submissions
    set status = 'rejected', admin_note = nullif(left(trim(p_admin_note), 1000), ''), reviewed_by = (select auth.uid()), reviewed_at = now()
    where id = p_submission_id;
    return v_submission.product_id;
  end if;

  v_product_id := v_submission.product_id;
  if v_product_id is null then
    v_slug := trim(both '-' from regexp_replace(lower(v_submission.product_name), '[^a-z0-9]+', '-', 'g'));
    v_slug := left(coalesce(nullif(v_slug, ''), 'product'), 90) || '-' || left(v_submission.id::text, 8);
    insert into public.products (category_id, name, slug, brand, model, unit, is_active)
    values (v_submission.category_id, v_submission.product_name, v_slug, v_submission.brand, v_submission.model, v_submission.unit, true)
    returning id into v_product_id;
  end if;

  if exists (
    select 1 from public.vendor_products vp
    where vp.vendor_id = v_submission.vendor_id and vp.product_id = v_product_id
      and vp.reserved_quantity > v_submission.stock_quantity
  ) then raise exception 'Submitted stock is lower than units already reserved' using errcode = 'P0001'; end if;

  insert into public.vendor_products (vendor_id, product_id, vendor_sku, price, stock_quantity, is_active, approval_status)
  values (v_submission.vendor_id, v_product_id, v_submission.vendor_sku, v_submission.price, v_submission.stock_quantity, true, 'approved')
  on conflict (vendor_id, product_id) do update
  set vendor_sku = excluded.vendor_sku, price = excluded.price, stock_quantity = excluded.stock_quantity,
      is_active = true, approval_status = 'approved', updated_at = now();

  update public.vendor_product_submissions
  set status = 'approved', product_id = v_product_id, admin_note = nullif(left(trim(p_admin_note), 1000), ''),
      reviewed_by = (select auth.uid()), reviewed_at = now()
  where id = p_submission_id;
  return v_product_id;
end;
$$;

revoke all on function public.vendor_upsert_inventory(uuid, uuid, numeric, integer, boolean, text) from public, anon;
revoke all on function public.submit_vendor_product(uuid, uuid, text, uuid, text, text, text, numeric, integer, text) from public, anon;
revoke all on function public.admin_review_vendor_product(uuid, boolean, text) from public, anon;
grant execute on function public.vendor_upsert_inventory(uuid, uuid, numeric, integer, boolean, text) to authenticated;
grant execute on function public.submit_vendor_product(uuid, uuid, text, uuid, text, text, text, numeric, integer, text) to authenticated;
grant execute on function public.admin_review_vendor_product(uuid, boolean, text) to authenticated;
