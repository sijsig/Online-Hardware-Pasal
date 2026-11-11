import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useFocusEffect, Link, router } from 'expo-router';
import { AppButton, Card, EmptyState, Notice, PageHeader, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/auth/auth-provider';
import { getFriendlyError, money } from '@/src/marketplace';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme';

type OrderRow = { id: string; status: string; total: number; created_at: string; vendors: { name: string } | null };
const statusNames: Record<string, string> = { pending: 'Awaiting shop confirmation', confirmed: 'Confirmed', preparing: 'Being prepared', ready_for_pickup: 'Ready for pickup', picked_up: 'Picked up', out_for_delivery: 'On the way', delivered: 'Delivered', cancelled: 'Cancelled', rejected: 'Not accepted' };

export default function OrdersScreen() {
  const { session } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!session) { setBusy(false); setOrders([]); return; }
    setBusy(true);
    const { data, error: queryError } = await supabase.from('orders').select('id,status,total,created_at,vendors(name)').order('created_at', { ascending: false }).limit(30);
    if (queryError) setError(getFriendlyError(queryError)); else { setError(''); setOrders((data ?? []) as unknown as OrderRow[]); }
    setBusy(false);
  }, [session]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    if (!session) return;
    const channel = supabase.channel(`mobile-orders-${session.user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${session.user.id}` }, () => { void load(); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [session, load]);
  return <Screen><PageHeader eyebrow="Stay in the loop" title="Your orders" subtitle="Updates from the shop and rider appear here." />
    {!session ? <EmptyState title="Sign in to see orders" detail="Your orders stay connected to your account." action={<AppButton title="Sign in" onPress={() => router.push('/login')} />} /> : busy ? <ActivityIndicator color={colors.green} /> : error ? <Notice tone="error">{error}</Notice> : !orders.length ? <EmptyState title="No orders yet" detail="Orders you place from nearby shops will show here." action={<Link href="/(tabs)/search" asChild><AppButton title="Find hardware" onPress={() => router.push('/(tabs)/search')} /></Link>} /> : orders.map((order) => <Card key={order.id} style={{ padding: 0, overflow: 'hidden' }}><View style={{ padding: 14, gap: 8 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Text numberOfLines={1} style={{ flex: 1, fontWeight: '800', color: colors.ink }}>{order.vendors?.name ?? 'Hardware shop'}</Text><Text style={{ fontWeight: '900', color: colors.green }}>{money(order.total)}</Text></View><Text style={{ color: colors.muted, fontSize: 12 }}>{statusNames[order.status] ?? order.status.replaceAll('_', ' ')} · {new Date(order.created_at).toLocaleDateString()}</Text><Text style={{ color: colors.muted, fontSize: 10 }}>Order {order.id.slice(0, 8).toUpperCase()}</Text><AppButton title="View order & delivery" variant="quiet" onPress={() => router.push(`/order/${order.id}`)} /></View></Card>)}
  </Screen>;
}
