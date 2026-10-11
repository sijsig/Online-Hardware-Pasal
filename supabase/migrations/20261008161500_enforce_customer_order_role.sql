-- A browser session may belong to a vendor or rider; only customer profiles
-- can create delivery addresses or customer orders.
create or replace function public.enforce_customer_address_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id is distinct from (select auth.uid()) then
    raise exception 'Address owner must match the signed-in user' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = new.user_id and p.role = 'customer'
  ) then
    raise exception 'Only customer accounts can manage delivery addresses' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger addresses_require_customer_owner_insert
before insert on public.addresses
for each row execute function public.enforce_customer_address_owner();
create trigger addresses_require_customer_owner_update
before update of user_id on public.addresses
for each row execute function public.enforce_customer_address_owner();

create or replace function public.enforce_customer_order_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.customer_id is distinct from (select auth.uid()) then
    raise exception 'Order customer must match the signed-in user' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = new.customer_id and p.role = 'customer'
  ) then
    raise exception 'Only customer accounts can place orders' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger orders_require_customer_owner
before insert on public.orders
for each row execute function public.enforce_customer_order_owner();

revoke all on function public.enforce_customer_address_owner() from public, anon, authenticated;
revoke all on function public.enforce_customer_order_owner() from public, anon, authenticated;
