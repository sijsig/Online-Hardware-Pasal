-- Admin Settings & Feature Flags
-- Stores marketplace configuration and feature flags

-- 1. Settings table for key-value configuration
create table if not exists public.admin_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}',
  description text,
  category text not null default 'general',
  is_public boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_settings_category on public.admin_settings (category);
create index if not exists idx_admin_settings_key on public.admin_settings (key);

alter table public.admin_settings enable row level security;

-- Admins can manage all settings
create policy "Admins can manage all settings" on public.admin_settings
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'))
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'))
  );

-- Public settings can be read by anyone (for frontend config)
create policy "Public settings are readable by all" on public.admin_settings
  for select using (is_public = true);

-- Trigger for updated_at
create trigger set_admin_settings_updated_at
  before update on public.admin_settings
  for each row execute function public.set_updated_at();

-- 2. Feature Flags table (separate for easier management)
create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  enabled boolean not null default false,
  description text,
  rollout_percentage integer default 100 check (rollout_percentage >= 0 and rollout_percentage <= 100),
  target_roles text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_feature_flags_key on public.feature_flags (key);

alter table public.feature_flags enable row level security;

-- Admins can manage all feature flags
create policy "Admins can manage feature flags" on public.feature_flags
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'))
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'))
  );

-- Feature flags can be read by authenticated users (for client-side feature gating)
create policy "Authenticated users can read feature flags" on public.feature_flags
  for select using (auth.role() = 'authenticated');

-- Trigger for updated_at
create trigger set_feature_flags_updated_at
  before update on public.feature_flags
  for each row execute function public.set_updated_at();

-- 3. Insert default settings
insert into public.admin_settings (key, value, description, category, is_public) values
  ('marketplace.name', '"hardware pasal"', 'Platform display name', 'general', true),
  ('marketplace.support_email', '"support@hardwarepasal.com"', 'Support contact email', 'general', true),
  ('marketplace.support_phone', '"+977-1-XXXXXXX"', 'Support contact phone', 'general', true),
  ('commission.default_rate', '10', 'Default commission rate percentage', 'finance', false),
  ('commission.min_rate', '0', 'Minimum commission rate percentage', 'finance', false),
  ('commission.max_rate', '50', 'Maximum commission rate percentage', 'finance', false),
  ('orders.max_items_per_order', '50', 'Maximum items per order', 'orders', false),
  ('vendors.max_products_per_shop', '500', 'Maximum products per shop', 'vendors', false),
  ('delivery.default_fee', '100', 'Default delivery fee in NPR', 'delivery', true),
  ('delivery.free_threshold', '5000', 'Free delivery threshold in NPR', 'delivery', true)
on conflict (key) do nothing;

-- 4. Insert default feature flags
insert into public.feature_flags (key, enabled, description) values
  ('cod_enabled', true, 'Cash on Delivery payment method'),
  ('online_payment_enabled', true, 'Online payments (Khalti/eSewa)'),
  ('vendor_registration_enabled', true, 'Allow new vendor/shop registration'),
  ('rider_registration_enabled', true, 'Allow new rider registration'),
  ('reviews_enabled', false, 'Product reviews and ratings'),
  ('wishlist_enabled', false, 'Customer wishlist functionality'),
  ('notifications_email', true, 'Email notifications'),
  ('notifications_sms', false, 'SMS notifications'),
  ('notifications_push', true, 'Push notifications'),
  ('analytics_enabled', true, 'Analytics tracking'),
  ('maintenance_mode', false, 'Maintenance mode (read-only)')
on conflict (key) do nothing;
