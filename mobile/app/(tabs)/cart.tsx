import { Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { AppButton, Card, EmptyState, PageHeader, Screen } from '@/src/components/ui';
import { useCart } from '@/src/cart/cart-provider';
import { money } from '@/src/marketplace';
import { colors } from '@/src/theme';

export default function CartScreen() {
  const cart = useCart();
  return <Screen><PageHeader eyebrow="Your basket" title="Cart" subtitle={cart.items[0] ? `Ordering from ${cart.items[0].vendorName}` : 'Your cart is saved on this device.'} />
    {!cart.items.length ? <EmptyState title="Your cart is empty" detail="Search nearby shops and add products to start an order." action={<Link href="/(tabs)/search" asChild><AppButton title="Find hardware" onPress={() => router.push('/(tabs)/search')} /></Link>} /> : <>
      {cart.items.map((item) => <Card key={item.vendorProductId}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: colors.ink }}>{item.productName}</Text><Text style={{ fontSize: 12, color: colors.muted }}>{money(item.price)} each · max {item.availableStock}</Text></View><Text style={{ fontWeight: '900', color: colors.ink }}>{money(item.price * item.quantity)}</Text></View><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><AppButton title="−" variant="quiet" onPress={() => cart.quantity(item.vendorProductId, item.quantity - 1)} /><Text style={{ color: colors.ink, fontWeight: '900' }}>{item.quantity}</Text><AppButton title="+" variant="quiet" onPress={() => cart.quantity(item.vendorProductId, item.quantity + 1)} /><View style={{ flex: 1 }} /><AppButton title="Remove" variant="danger" onPress={() => cart.remove(item.vendorProductId)} /></View></Card>)}
      <Card><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.muted }}>Subtotal</Text><Text style={{ color: colors.ink, fontWeight: '900' }}>{money(cart.subtotal)}</Text></View><Text style={{ color: colors.muted, fontSize: 11 }}>Delivery fee is calculated by the selected shop during checkout. Stock and prices are rechecked when you place the order.</Text><AppButton title="Continue to checkout" onPress={() => router.push('/checkout')} /></Card>
    </>}
  </Screen>;
}
