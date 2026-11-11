-- Publish order status history so customers can see committed status changes live.
-- RLS on order_status_history limits visible rows to order participants.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'order_status_history'
     ) then
    execute 'alter publication supabase_realtime add table public.order_status_history';
  end if;
end;
$$;
