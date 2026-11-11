import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AppButton, Card, Field, Notice, PageHeader, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/auth/auth-provider';
import { getFriendlyError, money } from '@/src/marketplace';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme';

type ShopRequest = { id: string; name: string; city: string; address_line: string; phone: string | null };
type RiderRequest = { user_id: string; vehicle_type: string | null; application_status: string };
type ProductRequest = { id: string; product_name: string; brand: string | null; model: string | null; price: number; stock_quantity: number; vendors: { name: string } | null };
type AdminMetrics = { today_orders: number; today_order_value: number; today_commission: number; active_vendors: number; available_riders: number; pending_orders: number; active_deliveries: number; pending_shop_applications: number; pending_rider_applications: number };
type PayoutRequest = { id: string; order_id: string; subtotal_snapshot: number; rate_snapshot: number; commission_amount: number; vendor_payout: number; created_at: string; vendors: { name: string } | null };
type AdminOrder = { id: string; status: string; payment_status: string; total: number; created_at: string; vendors: { name: string } | null };
type AdminDelivery = { id: string; order_id: string; status: string; distance_to_vendor_meters: number | null; offered_at: string };
type OrderFilter = 'all' | 'open' | 'delivered' | 'attention';

export default function AdminScreen() {
  const { session, profile } = useAuth(); const [shops, setShops] = useState<ShopRequest[]>([]); const [riders, setRiders] = useState<RiderRequest[]>([]); const [products, setProducts] = useState<ProductRequest[]>([]);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null); const [payouts, setPayouts] = useState<PayoutRequest[]>([]); const [payoutReferences, setPayoutReferences] = useState<Record<string, string>>({}); const [orders, setOrders] = useState<AdminOrder[]>([]); const [deliveries, setDeliveries] = useState<AdminDelivery[]>([]); const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');
  const [commission, setCommission] = useState('10'); const [busy, setBusy] = useState(true); const [savingPayout, setSavingPayout] = useState(''); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    if (!session || profile?.role !== 'admin') { setBusy(false); return; }
    setBusy(true);
    try {
      const [shopResult, riderResult, productResult, metricResult, payoutResult, orderResult, deliveryResult] = await Promise.all([
        supabase.from('vendors').select('id,name,city,address_line,phone').eq('status', 'pending').order('created_at').limit(50),
        supabase.from('riders').select('user_id,vehicle_type,application_status').eq('application_status', 'pending').limit(50),
        supabase.from('vendor_product_submissions').select('id,product_name,brand,model,price,stock_quantity,vendors(name)').eq('status', 'pending').order('created_at').limit(50),
        supabase.rpc('admin_dashboard_metrics'),
        supabase.from('commissions').select('id,order_id,subtotal_snapshot,rate_snapshot,commission_amount,vendor_payout,created_at,vendors(name)').eq('status', 'earned').order('created_at').limit(50),
        supabase.from('orders').select('id,status,payment_status,total,created_at,vendors(name)').order('created_at', { ascending: false }).limit(50),
        supabase.from('delivery_assignments').select('id,order_id,status,distance_to_vendor_meters,offered_at').in('status', ['offered', 'accepted', 'picked_up']).order('offered_at', { ascending: false }).limit(50),
      ]);
      if (shopResult.error) throw shopResult.error; if (riderResult.error) throw riderResult.error; if (productResult.error) throw productResult.error; if (metricResult.error) throw metricResult.error; if (payoutResult.error) throw payoutResult.error; if (orderResult.error) throw orderResult.error; if (deliveryResult.error) throw deliveryResult.error;
      setShops((shopResult.data ?? []) as ShopRequest[]); setRiders((riderResult.data ?? []) as RiderRequest[]); setProducts((productResult.data ?? []) as unknown as ProductRequest[]); setError('');
      setMetrics(metricResult.data as AdminMetrics); setPayouts((payoutResult.data ?? []) as unknown as PayoutRequest[]);
      setOrders((orderResult.data ?? []) as unknown as AdminOrder[]); setDeliveries((deliveryResult.data ?? []) as AdminDelivery[]);
    } catch (e) { setError(getFriendlyError(e)); }
    finally { setBusy(false); }
  }, [session, profile?.role]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  async function reviewVendor(id: string, approve: boolean) {
    const { error: rpcError } = await supabase.rpc('review_vendor_application', { p_vendor_id: id, p_decision: approve ? 'active' : 'rejected', p_commission_rate: approve ? Number(commission) / 100 : null });
    if (rpcError) setError(getFriendlyError(rpcError)); else { setMessage(approve ? `Shop approved at ${commission}% commission.` : 'Shop application rejected.'); await load(); }
  }
  async function reviewRider(id: string, decision: 'approved' | 'rejected') {
    const { error: rpcError } = await supabase.rpc('review_rider_application', { p_rider_id: id, p_decision: decision });
    if (rpcError) setError(getFriendlyError(rpcError)); else { setMessage(`Rider application ${decision}.`); await load(); }
  }
  async function reviewProduct(id: string, approve: boolean) {
    const { error: rpcError } = await supabase.rpc('admin_review_vendor_product', { p_submission_id: id, p_approve: approve, p_admin_note: null });
    if (rpcError) setError(getFriendlyError(rpcError)); else { setMessage(approve ? 'Product approved and published to the shop.' : 'Product request rejected.'); await load(); }
  }
  async function recordPayout(payout: PayoutRequest) {
    const reference = (payoutReferences[payout.id] ?? '').trim();
    if (reference.length < 3) { setError('Enter the bank or wallet transfer reference (at least 3 characters).'); return; }
    setSavingPayout(payout.id); setError(''); setMessage('');
    const { error: rpcError } = await supabase.rpc('admin_record_vendor_payout', { p_commission_id: payout.id, p_reference: reference });
    if (rpcError) setError(getFriendlyError(rpcError)); else { setMessage(`Payout recorded for ${payout.vendors?.name ?? 'vendor'}: ${reference}.`); await load(); }
    setSavingPayout('');
  }
  const visibleOrders = orders.filter((order) => orderFilter === 'all' || orderFilter === 'open' && !['delivered', 'cancelled', 'rejected'].includes(order.status) || orderFilter === 'delivered' && order.status === 'delivered' || orderFilter === 'attention' && ['cancelled', 'rejected'].includes(order.status));
  if (!session) return <Screen><PageHeader title="Admin review" subtitle="Sign in with your administrator account." /><AppButton title="Sign in" onPress={() => router.push('/login')} /></Screen>;
  if (profile?.role !== 'admin') return <Screen><PageHeader title="Admin review" subtitle="This workspace is restricted to administrators." /><Notice tone="error">The database enforces admin permissions. Your account does not have the admin role.</Notice></Screen>;
  return <Screen><PageHeader eyebrow="Marketplace operations" title="Admin dashboard" subtitle="Review applications, monitor marketplace activity, and record vendor payouts." />
    {busy ? <ActivityIndicator color={colors.green} /> : null}{error ? <Notice tone="error">{error}</Notice> : null}{message ? <Notice tone="success">{message}</Notice> : null}
    {metrics ? <><Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900' }}>Today · Nepal time</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[["Orders", metrics.today_orders], ["Order value", money(metrics.today_order_value)], ["Commission", money(metrics.today_commission)], ["Pending orders", metrics.pending_orders], ["Active shops", metrics.active_vendors], ["Available riders", metrics.available_riders], ["Active deliveries", metrics.active_deliveries]].map(([label, value]) => <Card key={String(label)} style={{ flexGrow: 1, flexBasis: '44%' }}><Text style={{ color: colors.muted, fontSize: 11 }}>{label}</Text><Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900' }}>{value}</Text></Card>)}</View></> : null}
    <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900' }}>Delivery operations · {deliveries.length} active</Text>
    {deliveries.length ? deliveries.map((delivery) => <Card key={delivery.id}><Text style={{ color: colors.ink, fontWeight: '900' }}>Order {delivery.order_id.slice(0, 8).toUpperCase()} · {delivery.status.replaceAll('_', ' ')}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{delivery.distance_to_vendor_meters == null ? 'Distance unavailable' : `${(delivery.distance_to_vendor_meters / 1000).toFixed(1)} km from shop`} · offered {new Date(delivery.offered_at).toLocaleTimeString()}</Text><AppButton title="Open order details" variant="quiet" onPress={() => router.push(`/order/${delivery.order_id}`)} /></Card>) : !busy ? <Text style={{ color: colors.muted, fontSize: 12 }}>No active delivery assignments.</Text> : null}
    <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900' }}>Orders · latest {orders.length}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{([['all', 'All'], ['open', 'In progress'], ['delivered', 'Delivered'], ['attention', 'Cancelled / rejected']] as const).map(([filter, label]) => <AppButton key={filter} title={label} variant={orderFilter === filter ? 'secondary' : 'quiet'} onPress={() => setOrderFilter(filter)} />)}</View>
    {visibleOrders.length ? visibleOrders.map((order) => <Card key={order.id}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Text style={{ flex: 1, color: colors.ink, fontWeight: '900' }}>{order.vendors?.name ?? 'Shop'} · {money(order.total)}</Text><Text style={{ color: colors.green, fontWeight: '800' }}>{order.status.replaceAll('_', ' ')}</Text></View><Text style={{ color: colors.muted, fontSize: 12 }}>Payment {order.payment_status} · {new Date(order.created_at).toLocaleString()} · {order.id.slice(0, 8).toUpperCase()}</Text><AppButton title="View order details" variant="quiet" onPress={() => router.push(`/order/${order.id}`)} /></Card>) : !busy ? <Text style={{ color: colors.muted, fontSize: 12 }}>No orders match this filter.</Text> : null}
    <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900' }}>Vendor payouts · {payouts.length} ready</Text>
    {payouts.length ? payouts.map((payout) => <Card key={payout.id}><Text style={{ color: colors.ink, fontWeight: '900' }}>{payout.vendors?.name ?? 'Vendor'} · order {payout.order_id.slice(0, 8).toUpperCase()}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Sale {money(payout.subtotal_snapshot)} · commission {Number(payout.rate_snapshot * 100).toFixed(2)}% ({money(payout.commission_amount)})</Text><Text style={{ color: colors.green, fontWeight: '900' }}>Payout due: {money(payout.vendor_payout)}</Text><Field label="Transfer reference" value={payoutReferences[payout.id] ?? ''} onChangeText={(value) => setPayoutReferences((current) => ({ ...current, [payout.id]: value }))} placeholder="Bank or wallet transaction ID" /><AppButton title="Record vendor payout" loading={savingPayout === payout.id} onPress={() => void recordPayout(payout)} /></Card>) : !busy ? <Text style={{ color: colors.muted, fontSize: 12 }}>No earned commissions are awaiting payout.</Text> : null}
    <Card><Text style={{ color: colors.ink, fontWeight: '900' }}>New shops · {shops.length}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Approval sets the commission used for future orders.</Text><Text style={{ color: colors.ink }}>Commission rate: {commission}%</Text><View style={{ flexDirection: 'row', gap: 8 }}>{['5', '10', '15'].map((value) => <Text key={value} onPress={() => setCommission(value)} style={{ color: value === commission ? colors.green : colors.muted, padding: 6, fontWeight: '900' }}>{value}%</Text>)}</View>
      {shops.map((shop) => <View key={shop.id} style={{ paddingTop: 8, gap: 6 }}><Text style={{ color: colors.ink, fontWeight: '800' }}>{shop.name}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{shop.address_line}, {shop.city} · {shop.phone ?? 'No phone'}</Text><View style={{ flexDirection: 'row', gap: 8 }}><AppButton title="Approve shop" onPress={() => void reviewVendor(shop.id, true)} /><AppButton title="Reject" variant="danger" onPress={() => void reviewVendor(shop.id, false)} /></View></View>)}
      {!shops.length ? <Text style={{ color: colors.muted, fontSize: 12 }}>No shop applications waiting.</Text> : null}
    </Card>
    <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900' }}>Rider applications · {riders.length}</Text>
    {riders.map((rider) => <Card key={rider.user_id}><Text style={{ color: colors.ink, fontWeight: '800' }}>{rider.vehicle_type ?? 'Vehicle not selected'}</Text><Text style={{ color: colors.muted, fontSize: 10 }}>Profile {rider.user_id.slice(0, 8)}</Text><View style={{ flexDirection: 'row', gap: 8 }}><AppButton title="Approve rider" onPress={() => void reviewRider(rider.user_id, 'approved')} /><AppButton title="Reject" variant="danger" onPress={() => void reviewRider(rider.user_id, 'rejected')} /></View></Card>)}
    <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900' }}>Product listing requests · {products.length}</Text>
    {products.map((product) => <Card key={product.id}><Text style={{ color: colors.ink, fontWeight: '900' }}>{product.product_name}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{product.vendors?.name ?? 'Vendor'} · {product.brand ?? ''} {product.model ?? ''}</Text><Text style={{ color: colors.ink }}>{money(product.price)} · {product.stock_quantity} units</Text><View style={{ flexDirection: 'row', gap: 8 }}><AppButton title="Approve & publish" onPress={() => void reviewProduct(product.id, true)} /><AppButton title="Reject" variant="danger" onPress={() => void reviewProduct(product.id, false)} /></View></Card>)}
    {!products.length && !busy ? <Text style={{ color: colors.muted, fontSize: 12 }}>No products waiting for review.</Text> : null}
  </Screen>;
}
