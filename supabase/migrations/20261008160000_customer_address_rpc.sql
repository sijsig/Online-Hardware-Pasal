-- Save a customer's address with validated coordinates and a serialized default flag.
create or replace function public.create_customer_address(
  p_label text,
  p_recipient_name text,
  p_phone text,
  p_address_line text,
  p_city text,
  p_district text,
  p_province text,
  p_latitude double precision,
  p_longitude double precision,
  p_is_default boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_address_id uuid;
  v_make_default boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if nullif(pg_catalog.btrim(p_recipient_name), '') is null
    or nullif(pg_catalog.btrim(p_phone), '') is null
    or nullif(pg_catalog.btrim(p_address_line), '') is null
    or nullif(pg_catalog.btrim(p_city), '') is null then
    raise exception 'Name, phone, street address, and city are required' using errcode = '22023';
  end if;
  if p_latitude is null or p_longitude is null
    or p_latitude not between -90 and 90
    or p_longitude not between -180 and 180 then
    raise exception 'A valid map location is required' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));
  v_make_default := coalesce(p_is_default, false) or not exists (
    select 1 from public.addresses a where a.user_id = v_user_id and a.is_default
  );
  if v_make_default then
    update public.addresses set is_default = false where user_id = v_user_id and is_default;
  end if;

  insert into public.addresses (
    user_id, label, recipient_name, phone, address_line, city, district,
    province, location, is_default
  ) values (
    v_user_id,
    left(coalesce(nullif(pg_catalog.btrim(p_label), ''), 'Home'), 40),
    left(pg_catalog.btrim(p_recipient_name), 120),
    left(pg_catalog.btrim(p_phone), 30),
    left(pg_catalog.btrim(p_address_line), 300),
    left(pg_catalog.btrim(p_city), 100),
    left(nullif(pg_catalog.btrim(p_district), ''), 100),
    left(nullif(pg_catalog.btrim(p_province), ''), 100),
    extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
    v_make_default
  ) returning id into v_address_id;

  return v_address_id;
end;
$$;

revoke all on function public.create_customer_address(text, text, text, text, text, text, text, double precision, double precision, boolean) from public, anon;
grant execute on function public.create_customer_address(text, text, text, text, text, text, text, double precision, double precision, boolean) to authenticated;
