import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AppButton, Card, Notice, PageHeader, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/auth/auth-provider';
import { getFriendlyError, money } from '@/src/marketplace';
import { mapLocationUrl } from '@/src/maps/navigation';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme';
import { OrderTrackingMap, useRiderLocation } from '@/src/components/order-tracking-map';

type Order = { id: string; status: string; payment_status: string; payment_method: string; subtotal: number; delivery_fee: number; discount: number; total: number; created_at: string; delivery_address_snapshot: Record<string, unknown>; vendors: { name: string; phone: string; latitude?: number; longitude?: number } | null };
type OrderItem = { id: string; product_name_snapshot: string; unit_snapshot: string; unit_price_snapshot: number; quantity: number; line_total: number };
type History = { id: number; from_status: string | null; to_status: string; note: string | null; created_at: string };
type Assignment = { status: string; accepted_at: string | null; picked_up_at: string | null; delivered_at: string | null };

const statusLabels: Record<string, string> = { pending: 'Waiting for shop confirmation', confirmed: 'Shop confirmed your order', preparing: 'Shop is preparing your items', ready_for_pickup: 'Ready for rider pickup', picked_up: 'Picked up from shop', out_for_delivery: 'On the way to you', delivered: 'Delivered', cancelled: 'Cancelled', rejected: 'Shop could not accept this order' };

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { session } = useAuth();
  const [order, setOrder] = useState<Order | null>(null); const [items, setItems] = useState<OrderItem[]>([]); const [history, setHistory] = useState<History[]>([]); const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [busy, setBusy] = useState(true); const [cancelling, setCancelling] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const { riderLocation, locationError } = useRiderLocation(id ?? '', assignment?.status ?? '');
  const load = useCallback(async () => {
    if (!session || !id) { setBusy(false); return; }
    setBusy(true); setError('');
    try {
      const [orderResult, itemResult, historyResult, assignmentResult] = await Promise.all([
        supabase.from('orders').select('id,status,payment_status,payment_method,subtotal,delivery_fee,discount,total,created_at,delivery_address_snapshot,vendors(name,phone,latitude,longitude)').eq('id', id).maybeSingle(),
        supabase.from('order_items').select('id,product_name_snapshot,unit_snapshot,unit_price_snapshot,quantity,line_total').eq('order_id', id).order('created_at'),
        supabase.from('order_status_history').select('id,from_status,to_status,note,created_at').eq('order_id', id).order('created_at'),
        supabase.from('delivery_assignments').select('status,accepted_at,picked_up_at,delivered_at').eq('order_id', id).order('offered_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (orderResult.error) throw orderResult.error; if (itemResult.error) throw itemResult.error; if (historyResult.error) throw historyResult.error; if (assignmentResult.error) throw assignmentResult.error;
      if (!orderResult.data) throw new Error('This order could not be found in your account.');
      setOrder(orderResult.data as unknown as Order); setItems((itemResult.data ?? []) as OrderItem[]); setHistory((historyResult.data ?? []) as History[]); setAssignment(assignmentResult.data as Assignment | null);
    } catch (e) { setError(getFriendlyError(e)); }
    finally { setBusy(false); }
  }, [session, id]);

  async function cancelPendingOrder() {
    if (!order) return;
    setCancelling(true); setError(''); setMessage('');
    const { error: cancelError } = await supabase.rpc('cancel_pending_order', { p_order_id: order.id, p_note: 'Cancelled by customer' });
    if (cancelError) setError(getFriendlyError(cancelError));
    else { setMessage('Your order was cancelled and reserved stock was released.'); await load(); }
    setCancelling(false);
  }
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    if (!session || !id) return;
    const channel = supabase.channel(`mobile-order-detail-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_status_history', filter: `order_id=eq.${id}` }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_assignments', filter: `order_id=eq.${id}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [session, id, load]);

  if (!session) return <Screen><PageHeader title="Order details" subtitle="Sign in to view this order." /><AppButton title="Sign in" onPress={() => router.push('/login')} /></Screen>;
  if (busy) return <Screen><ActivityIndicator color={colors.green} /></Screen>;
  if (error || !order) return <Screen><PageHeader title="Order details" /><Notice tone="error">{error || 'Order not found.'}</Notice><AppButton title="Back to orders" variant="quiet" onPress={() => router.back()} /></Screen>;
  const address = order.delivery_address_snapshot ?? {};
  return <Screen><PageHeader eyebrow={`Order ${order.id.slice(0, 8).toUpperCase()}`} title={statusLabels[order.status] ?? order.status.replaceAll('_', ' ')} subtitle={`${order.vendors?.name ?? 'Hardware shop'} · ${new Date(order.created_at).toLocaleString()}`} />
    {error ? <Notice tone="error">{error}</Notice> : null}{message ? <Notice tone="success">{message}</Notice> : null}
    {order.status === 'pending' ? <AppButton title="Cancel this order" variant="danger" loading={cancelling} onPress={() => Alert.alert('Cancel order?', 'This will release the reserved stock. You cannot undo this.', [{ text: 'Keep order', style: 'cancel' }, { text: 'Cancel order', style: 'destructive', onPress: () => void cancelPendingOrder() }])} /> : null}
    
    {/* Live Tracking Map */}
    {assignment && ['accepted', 'picked_up'].includes(assignment.status) && (
      <OrderTrackingMap
        orderId={id}
        riderLocation={riderLocation}
        assignmentStatus={assignment.status}
        deliveryAddress={address as any}
        vendorLocation={order.vendors?.latitude && order.vendors?.longitude ? { latitude: order.vendors.latitude, longitude: order.vendors.longitude, name: order.vendors.name } : null}
      />
    )}
    
    <Card><Text style={{ color: colors.ink, fontWeight: '900', fontSize: 16 }}>Delivery</Text><Text style={{ color: colors.muted }}>{String(address.recipient_name ?? 'Recipient')} · {String(address.phone ?? '')}</Text><Text style={{ color: colors.ink }}>{String(address.address_line ?? '')}, {String(address.city ?? '')}{address.district ? `, ${String(address.district)}` : ''}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Delivery status: {assignment?.status?.replaceAll('_', ' ') ?? (['pending', 'confirmed', 'preparing', 'ready_for_pickup'].includes(order.status) ? 'Waiting for rider assignment' : 'No active delivery')}</Text>
    {assignment && ['accepted', 'picked_up'].includes(assignment.status) ? locationError ? <Text style={{ color: colors.red, fontSize: 12 }}>{locationError}</Text> : riderLocation ? <Text style={{ color: colors.green, fontWeight: '800', fontSize: 12 }}>Rider location updated {new Date(riderLocation.location_updated_at).toLocaleTimeString()}</Text> : <Text style={{ color: colors.muted, fontSize: 12 }}>Waiting for the rider's first location update…</Text> : null}{order.vendors?.phone ? <Text style={{ color: colors.muted, fontSize: 12 }}>Shop contact: {order.vendors.phone}</Text> : null}</Card>
    <Card><Text style={{ color: colors.ink, fontWeight: '900', fontSize: 16 }}>Items</Text>{items.map((item) => <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Text style={{ color: colors.ink, flex: 1 }}>{item.quantity} × {item.product_name_snapshot} ({item.unit_snapshot})</Text><Text style={{ color: colors.ink, fontWeight: '800' }}>{money(item.line_total)}</Text></View>)}<View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8, gap: 4 }}><Text style={{ color: colors.muted }}>Items {money(order.subtotal)}</Text><Text style={{ color: colors.muted }}>Delivery {money(order.delivery_fee)}</Text>{Number(order.discount) > 0 ? <Text style={{ color: colors.muted }}>Discount −{money(order.discount)}</Text> : null}<Text style={{ color: colors.ink, fontWeight: '900' }}>Total {money(order.total)} · {order.payment_method.replaceAll('_', ' ').toUpperCase()}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Payment: {order.payment_status}</Text></View></Card>
    <Card><Text style={{ color: colors.ink, fontWeight: '900', fontSize: 16 }}>Order updates</Text>{history.length ? history.map((event) => <View key={event.id} style={{ borderLeftWidth: 2, borderLeftColor: colors.green, paddingLeft: 10, gap: 3 }}><Text style={{ color: colors.ink, fontWeight: '800' }}>{statusLabels[event.to_status] ?? event.to_status.replaceAll('_', ' ')}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>{new Date(event.created_at).toLocaleString()}</Text>{event.note ? <Text style={{ color: colors.muted, fontSize: 12 }}>{event.note}</Text> : null}</View>) : <Text style={{ color: colors.muted }}>Your order was placed. Shop updates will appear here.</Text>}</Card>
  </Screen>;
}
