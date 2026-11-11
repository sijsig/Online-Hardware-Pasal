create or replace function public.apply_for_vendor_shop(
  p_name text,
  p_phone text,
  p_email text,
  p_address_line text,
  p_city text,
  p_district text,
  p_province text,
  p_description text,
  p_latitude double precision,
  p_longitude double precision
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_name text := left(trim(p_name), 120);
  v_base_slug text;
  v_slug text;
  v_vendor_id uuid;
begin
  if v_owner_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if v_name is null or length(v_name) < 2 then
    raise exception 'Shop name must be at least 2 characters' using errcode = '22023';
  end if;
  if p_phone is null or length(trim(p_phone)) < 7 or length(trim(p_phone)) > 32 then
    raise exception 'Enter a valid shop phone number' using errcode = '22023';
  end if;
  if p_address_line is null or length(trim(p_address_line)) < 3 or length(trim(p_address_line)) > 240 then
    raise exception 'Enter a valid shop address' using errcode = '22023';
  end if;
  if p_city is null or length(trim(p_city)) < 2 or length(trim(p_city)) > 100 then
    raise exception 'Enter a valid city or municipality' using errcode = '22023';
  end if;
  if p_latitude is null or p_latitude < 26 or p_latitude > 31 or p_longitude is null or p_longitude < 80 or p_longitude > 89 then
    raise exception 'Choose a shop location in Nepal' using errcode = '22023';
  end if;

  v_base_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  if v_base_slug = '' then v_base_slug := 'hardware-shop'; end if;
  v_slug := left(v_base_slug, 80) || '-' || substr(md5(v_owner_id::text || clock_timestamp()::text), 1, 8);

  insert into public.vendors (
    owner_id, name, slug, description, phone, email, address_line, city,
    district, province, location, delivery_radius_meters,
    estimated_delivery_minutes, base_delivery_fee, commission_rate, status, is_demo
  ) values (
    v_owner_id, v_name, v_slug, nullif(left(trim(p_description), 1000), ''),
    left(trim(p_phone), 32), nullif(left(trim(p_email), 254), ''),
    left(trim(p_address_line), 240), left(trim(p_city), 100),
    nullif(left(trim(p_district), 100), ''), nullif(left(trim(p_province), 100), ''),
    extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
    5000, 60, 0, null, 'pending', false
  ) returning id into v_vendor_id;

  return v_vendor_id;
end;
$$;

revoke all on function public.apply_for_vendor_shop(text, text, text, text, text, text, text, text, double precision, double precision) from public, anon;
grant execute on function public.apply_for_vendor_shop(text, text, text, text, text, text, text, text, double precision, double precision) to authenticated;
