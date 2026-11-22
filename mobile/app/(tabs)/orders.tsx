import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, Link, router } from 'expo-router';
import { AppButton, Card, EmptyState, Notice, PageHeader, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/auth/auth-provider';
import { useCart } from '@/src/cart/cart-provider';
import { getFriendlyError, money } from '@/src/marketplace';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme';
import { ReviewModal } from '@/src/components/review-modal';

type OrderRow = { id: string; status: string; total: number; created_at: string; vendors: { name: string } | null };
type OrderItem = { id: string; product_id: string; vendor_product_id: string; product_name: string; quantity: number; unit: string; price: number; vendor_id: string; vendor_name: string; available_stock: number };
const statusNames: Record<string, string> = { pending: 'Awaiting shop confirmation', confirmed: 'Confirmed', preparing: 'Being prepared', ready_for_pickup: 'Ready for pickup', picked_up: 'Picked up', out_for_delivery: 'On the way to you', delivered: 'Delivered', cancelled: 'Cancelled', rejected: 'Not accepted' };

export default function OrdersScreen() {
  const { session } = useAuth();
  const cart = useCart();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [reviewState, setReviewState] = useState<{ show: boolean; orderId: string; items: OrderItem[]; currentIndex: number; vendorId: string; vendorName: string } | null>(null);
  const [reorderState, setReorderState] = useState<{ show: boolean; orderId: string; items: OrderItem[]; vendorId: string; vendorName: string } | null>(null);
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

  async function openReviewModal(orderId: string, vendorId: string, vendorName: string) {
    const { data: items, error } = await supabase.from('order_items').select('id,product_id,product_name,quantity').eq('order_id', orderId);
    if (error || !items?.length) { Alert.alert('No items to review'); return; }
    setReviewState({ show: true, orderId, items: items as unknown as OrderItem[], currentIndex: 0, vendorId, vendorName });
  }

  async function openReorderModal(orderId: string, vendorId: string, vendorName: string) {
    const { data: items, error } = await supabase.from('order_items').select('id,product_id,vendor_product_id,product_name,quantity,unit,unit_price,vendor_id,available_stock,vendor_name').eq('order_id', orderId);
    if (error || !items?.length) { Alert.alert('No items to reorder'); return; }
    setReorderState({ show: true, orderId, items: items as unknown as OrderItem[], vendorId, vendorName });
  }

  function closeReviewModal() { setReviewState(null); }
  function closeReorderModal() { setReorderState(null); }

  function handleReviewSuccess() {
    if (!reviewState) return;
    const nextIndex = reviewState.currentIndex + 1;
    if (nextIndex < reviewState.items.length) {
      setReviewState(prev => prev ? { ...prev, currentIndex: nextIndex } : null);
    } else {
      closeReviewModal();
    }
  }

  function handleReorder() {
    if (!reorderState) return;
    // Add all items to cart
    let errorMsg: string | null = null;
    for (const item of reorderState.items) {
      const msg = cart.add({
        vendorProductId: item.vendor_product_id,
        productId: item.product_id,
        vendorId: item.vendor_id,
        vendorName: item.vendor_name,
        productName: item.product_name,
        unit: item.unit,
        price: Number(item.price),
        availableStock: item.available_stock,
      });
      if (msg) { errorMsg = msg; break; }
    }
    if (errorMsg) {
      Alert.alert('Could not add all items', errorMsg);
      return;
    }
    router.replace('/checkout');
    closeReorderModal();
  }

  return <Screen><PageHeader eyebrow="Stay in the loop" title="Your orders" subtitle="Updates from the shop and rider appear here." />
    {!session ? <EmptyState title="Sign in to see orders" detail="Your orders stay connected to your account." action={<AppButton title="Sign in" onPress={() => router.push('/login')} />} /> : busy ? <ActivityIndicator color={colors.green} /> : error ? <Notice tone="error">{error}</Notice> : !orders.length ? <EmptyState title="No orders yet" detail="Orders you place from nearby shops will show here." action={<Link href="/(tabs)/search" asChild><AppButton title="Find hardware" onPress={() => router.push('/(tabs)/search')} /></Link>} /> : orders.map((order) => <Card key={order.id} style={{ padding: 0, overflow: 'hidden' }}><View style={{ padding: 14, gap: 8 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Text numberOfLines={1} style={{ flex: 1, fontWeight: '800', color: colors.ink }}>{order.vendors?.name ?? 'Hardware shop'}</Text><Text style={{ fontWeight: '900', color: colors.green }}>{money(order.total)}</Text></View><Text style={{ color: colors.muted, fontSize: 12 }}>{statusNames[order.status] ?? order.status.replaceAll('_', ' ')} · {new Date(order.created_at).toLocaleDateString()}</Text><Text style={{ color: colors.muted, fontSize: 10 }}>Order {order.id.slice(0, 8).toUpperCase()}</Text>
    {order.status === 'delivered' ? (
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <AppButton title="Write review" variant="secondary" onPress={() => openReviewModal(order.id, order.vendors?.name ?? '', order.vendors?.name ?? '')} />
        <AppButton title="Reorder" variant="primary" onPress={() => openReorderModal(order.id, order.vendors?.name ?? '', order.vendors?.name ?? '')} />
      </View>
    ) : (
      <AppButton title="View order & delivery" variant="quiet" onPress={() => router.push(`/order/${order.id}`)} />
    )}
    </View></Card>)}
    {reviewState && (
      <ReviewModal
        productId={reviewState.items[reviewState.currentIndex].product_id}
        productName={reviewState.items[reviewState.currentIndex].product_name}
        shopId={reviewState.vendorId}
        orderId={reviewState.orderId}
        onClose={closeReviewModal}
        onSuccess={handleReviewSuccess}
      />
    )}
    {reorderState && (
      <ReorderModal
        items={reorderState.items}
        vendorName={reorderState.vendorName}
        onClose={closeReorderModal}
        onReorder={handleReorder}
      />
    )}
  </Screen>;
}

// Reorder Modal
function ReorderModal({ items, vendorName, onClose, onReorder }: { items: OrderItem[]; vendorName: string; onClose: () => void; onReorder: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  return <Screen style={{ paddingTop: 0 }}>
    <PageHeader eyebrow="Reorder items" title={vendorName} subtitle={`${items.length} item${items.length !== 1 ? 's' : ''} from your last order`} />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, gap: 16 }}>
      <ScrollView contentContainerStyle={{ gap: 12 }}>
        {items.map((item) => (
          <Card key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontWeight: '800', color: colors.ink }}>{item.product_name}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{item.quantity} {item.unit} × {money(item.price)}</Text>
              <Text style={{ color: item.available_stock > 0 ? colors.green : colors.red, fontSize: 12, fontWeight: '800' }}>
                {item.available_stock > 0 ? `${item.available_stock} in stock` : 'Out of stock'}
              </Text>
            </View>
          </Card>
        ))}
        {error ? <Text style={{ color: colors.red, textAlign: 'center' }}>{error}</Text> : null}
      </ScrollView>
      <AppButton title={loading ? 'Adding to cart...' : 'Add all to cart'} loading={loading} onPress={onReorder} />
      <AppButton title="Cancel" variant="quiet" onPress={onClose} />
    </KeyboardAvoidingView>
  </Screen>;
}
