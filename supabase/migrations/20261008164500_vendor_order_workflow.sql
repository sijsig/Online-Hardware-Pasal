create or replace function public.vendor_update_order_status(
  p_order_id uuid,
  p_next_status public.order_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_order record;
  v_line record;
  v_can_manage boolean;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select o.id, o.vendor_id, o.status
  into v_order
  from public.orders o
  where o.id = p_order_id
  for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  select public.is_vendor_owner(v_order.vendor_id) or exists (
    select 1 from public.vendor_staff s
    where s.vendor_id = v_order.vendor_id
      and s.user_id = v_actor
      and s.is_active
      and s.staff_role in ('manager', 'orders')
  ) into v_can_manage;
  if not v_can_manage then
    raise exception 'Not allowed to manage this shop order' using errcode = '42501';
  end if;

  if not (
    (v_order.status = 'pending' and p_next_status in ('confirmed', 'rejected'))
    or (v_order.status = 'confirmed' and p_next_status = 'preparing')
    or (v_order.status = 'preparing' and p_next_status = 'ready_for_pickup')
  ) then
    raise exception 'Invalid order status transition' using errcode = '22023';
  end if;

  if p_next_status = 'rejected' then
    for v_line in
      select oi.vendor_product_id, sum(oi.quantity)::integer as quantity
      from public.order_items oi
      where oi.order_id = p_order_id
      group by oi.vendor_product_id
      order by oi.vendor_product_id
    loop
      update public.vendor_products vp
      set reserved_quantity = vp.reserved_quantity - v_line.quantity
      where vp.id = v_line.vendor_product_id
        and vp.reserved_quantity >= v_line.quantity;
      if not found then
        raise exception 'Reserved stock could not be released safely' using errcode = 'P0001';
      end if;
    end loop;
  end if;

  perform set_config(
    'app.order_status_note',
    coalesce(nullif(left(trim(p_note), 500), ''), case when p_next_status = 'rejected' then 'Rejected by shop' else '' end),
    true
  );
  update public.orders set status = p_next_status where id = p_order_id;
end;
$$;

revoke all on function public.vendor_update_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.vendor_update_order_status(uuid, public.order_status, text) to authenticated;
