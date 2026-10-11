-- Initial schema migration for Hardware Online Pasal
-- This mirrors the root schema definition for local Supabase setup.

create extension if not exists pgcrypto;

create type public.order_status as enum (
  'pending',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled'
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text,
  city text,
  district text,
  is_vendor boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  phone text,
  email text,
  address text,
  latitude double precision,
  longitude double precision,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete set null,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  price numeric(12,2) not null check (price > 0),
  compare_at_price numeric(12,2),
  currency text not null default 'NPR',
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  unit text,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  image_url text not null,
  alt_text text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete restrict,
  shop_id uuid not null references public.shops (id) on delete restrict,
  status public.order_status not null default 'pending',
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  shipping_fee numeric(12,2) not null default 0 check (shipping_fee >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  currency text not null default 'NPR',
  shipping_address jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total_price numeric(12,2) not null check (total_price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, buyer_id)
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger shops_set_updated_at
before update on public.shops
for each row
execute function public.set_updated_at();

create trigger categories_set_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

create trigger orders_set_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

create trigger reviews_set_updated_at
before update on public.reviews
for each row
execute function public.set_updated_at();

create index if not exists idx_profiles_city on public.profiles (city);
create index if not exists idx_profiles_vendor on public.profiles (is_vendor);
create index if not exists idx_shops_owner on public.shops (owner_id);
create index if not exists idx_shops_active on public.shops (is_active);
create index if not exists idx_categories_parent on public.categories (parent_id);
create index if not exists idx_products_shop on public.products (shop_id);
create index if not exists idx_products_category on public.products (category_id);
create index if not exists idx_products_active on public.products (is_active);
create index if not exists idx_product_images_primary on public.product_images (product_id, is_primary);
create index if not exists idx_orders_buyer on public.orders (buyer_id);
create index if not exists idx_orders_shop on public.orders (shop_id);
create index if not exists idx_orders_status on public.orders (status);
create index if not exists idx_order_items_order on public.order_items (order_id);
create index if not exists idx_reviews_product on public.reviews (product_id);
create index if not exists idx_favorites_user on public.favorites (user_id);

alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.reviews enable row level security;
alter table public.favorites enable row level security;

create policy "Profiles are viewable by everyone"
on public.profiles for select
using (true);

create policy "Users can insert their own profile"
on public.profiles for insert
with check (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Anyone can read active shops"
on public.shops for select
using (is_active = true);

create policy "Vendors can manage their own shop"
on public.shops for insert
with check (auth.uid() = owner_id);

create policy "Vendors can update their own shop"
on public.shops for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "Anyone can read categories"
on public.categories for select
using (true);

create policy "Anyone can read active products"
on public.products for select
using (is_active = true);

create policy "Vendors can manage their own products"
on public.products for insert
with check (exists (
  select 1
  from public.shops s
  where s.id = shop_id
    and s.owner_id = auth.uid()
));

create policy "Vendors can update their own products"
on public.products for update
using (exists (
  select 1
  from public.shops s
  where s.id = shop_id
    and s.owner_id = auth.uid()
))
with check (exists (
  select 1
  from public.shops s
  where s.id = shop_id
    and s.owner_id = auth.uid()
));

create policy "Anyone can view product images"
on public.product_images for select
using (true);

create policy "Vendors can manage product images"
on public.product_images for all
using (exists (
  select 1
  from public.products p
  join public.shops s on s.id = p.shop_id
  where p.id = product_id
    and s.owner_id = auth.uid()
))
with check (exists (
  select 1
  from public.products p
  join public.shops s on s.id = p.shop_id
  where p.id = product_id
    and s.owner_id = auth.uid()
));

create policy "Users can view their own orders or shop orders"
on public.orders for select
using (
  buyer_id = auth.uid()
  or exists (
    select 1
    from public.shops s
    where s.id = shop_id and s.owner_id = auth.uid()
  )
);

create policy "Users can create their own orders"
on public.orders for insert
with check (buyer_id = auth.uid());

create policy "Order buyers and shop owners can update orders"
on public.orders for update
using (
  buyer_id = auth.uid()
  or exists (
    select 1
    from public.shops s
    where s.id = shop_id and s.owner_id = auth.uid()
  )
)
with check (
  buyer_id = auth.uid()
  or exists (
    select 1
    from public.shops s
    where s.id = shop_id and s.owner_id = auth.uid()
  )
);

create policy "Users can view order items for their own orders or shop orders"
on public.order_items for select
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_id
      and (
        o.buyer_id = auth.uid()
        or exists (
          select 1
          from public.shops s
          where s.id = o.shop_id and s.owner_id = auth.uid()
        )
      )
  )
);

create policy "Users can manage their own order items"
on public.order_items for insert
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_id
      and o.buyer_id = auth.uid()
  )
);

create policy "Anyone can read product reviews"
on public.reviews for select
using (true);

create policy "Users can create reviews for delivered products"
on public.reviews for insert
with check (
  buyer_id = auth.uid()
  and exists (
    select 1
    from public.orders o
    where o.shop_id = shop_id
      and o.buyer_id = auth.uid()
      and o.status = 'delivered'
  )
);

create policy "Users can update their own reviews"
on public.reviews for update
using (buyer_id = auth.uid())
with check (buyer_id = auth.uid());

create policy "Anyone can read favorites"
on public.favorites for select
using (true);

create policy "Users can manage their own favorites"
on public.favorites for insert
with check (user_id = auth.uid());

create policy "Users can delete their own favorites"
on public.favorites for delete
using (user_id = auth.uid());

comment on table public.profiles is 'Stores public profile data for authenticated users.';
comment on table public.shops is 'Independent hardware shops available on the marketplace.';
comment on table public.categories is 'Product categories used to organize inventory.';
comment on table public.products is 'Catalog products for each shop.';
comment on table public.orders is 'Customer orders placed against shop inventories.';
comment on table public.reviews is 'Customer review and rating records for products.';
comment on table public.favorites is 'Saved products for each user.';
