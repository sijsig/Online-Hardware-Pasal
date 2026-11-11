-- Keep checkout on COD until a payment provider webhook is implemented.
create or replace function public.guard_unconfigured_payment_method()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payment_method <> 'cash_on_delivery' then
    raise exception 'This payment method is not available yet' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger orders_require_configured_payment_method
before insert on public.orders
for each row execute function public.guard_unconfigured_payment_method();

-- Record the COD payment intent at order creation. It remains pending until a
-- verified collection workflow is added; delivery status alone does not mark it paid.
create or replace function public.create_order_payment_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.payments(order_id, method, status, amount, currency)
  values (new.id, new.payment_method, 'pending', new.total, 'NPR');
  return new;
end;
$$;

create trigger orders_create_payment_record
after insert on public.orders
for each row execute function public.create_order_payment_record();

create or replace function public.finalize_order_commission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'delivered' and old.status is distinct from new.status then
    update public.commissions set status = 'earned'
    where order_id = new.id and status = 'pending';
  elsif new.status in ('cancelled', 'rejected') and old.status is distinct from new.status then
    update public.commissions set status = 'void'
    where order_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;

create trigger orders_finalize_commission
after update of status on public.orders
for each row execute function public.finalize_order_commission();

alter table public.commissions
  add column payout_reference text,
  add constraint commissions_payout_reference_length check (payout_reference is null or length(payout_reference) <= 120);

create or replace function public.admin_record_vendor_payout(p_commission_id uuid, p_reference text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_reference is null or length(trim(p_reference)) < 3 or length(trim(p_reference)) > 120 then
    raise exception 'Enter a payout reference between 3 and 120 characters' using errcode = '22023';
  end if;
  update public.commissions
  set status = 'paid', paid_at = clock_timestamp(), payout_reference = trim(p_reference)
  where id = p_commission_id and status = 'earned';
  if not found then
    raise exception 'Only earned commissions can be marked paid' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.admin_dashboard_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_start timestamptz := date_trunc('day', now() at time zone 'Asia/Kathmandu') at time zone 'Asia/Kathmandu';
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'today_orders', (select count(*) from public.orders where created_at >= v_start),
    'today_order_value', (select coalesce(sum(total), 0) from public.orders where created_at >= v_start and status not in ('cancelled', 'rejected')),
    'today_commission', (select coalesce(sum(commission_amount), 0) from public.commissions where created_at >= v_start and status <> 'void'),
    'active_vendors', (select count(*) from public.vendors where status = 'active'),
    'available_riders', (select count(*) from public.riders where application_status = 'approved' and status = 'available'),
    'pending_orders', (select count(*) from public.orders where status = 'pending'),
    'active_deliveries', (select count(*) from public.delivery_assignments where status in ('offered', 'accepted', 'picked_up')),
    'pending_shop_applications', (select count(*) from public.vendors where status = 'pending'),
    'pending_rider_applications', (select count(*) from public.riders where application_status = 'pending')
  );
end;
$$;

revoke all on function public.guard_unconfigured_payment_method() from public, anon, authenticated;
revoke all on function public.create_order_payment_record() from public, anon, authenticated;
revoke all on function public.finalize_order_commission() from public, anon, authenticated;
revoke all on function public.admin_dashboard_metrics() from public, anon;
revoke all on function public.admin_record_vendor_payout(uuid, text) from public, anon;
grant execute on function public.admin_dashboard_metrics() to authenticated;
grant execute on function public.admin_record_vendor_payout(uuid, text) to authenticated;
