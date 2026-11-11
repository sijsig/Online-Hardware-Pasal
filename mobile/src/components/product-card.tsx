import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { NearbyProduct } from '@/src/marketplace';
import { formatDistance, money } from '@/src/marketplace';
import { Card, AppButton } from '@/src/components/ui';
import { useCart } from '@/src/cart/cart-provider';
import { colors } from '@/src/theme';
import { useState } from 'react';

export function ProductCard({ product }: { product: NearbyProduct }) {
  const { add } = useCart();
  const [message, setMessage] = useState('');
  return <Card>
    <Link href={{ pathname: '/product/[id]', params: { id: product.product_id, name: product.product_name } }} asChild>
      <Pressable><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><View style={{ flex: 1, gap: 5 }}><Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink }}>{product.product_name}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{product.vendor_name} · {formatDistance(product.distance_meters)} away</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Est. {product.estimated_delivery_minutes} min delivery</Text></View><Text style={{ color: colors.green, fontSize: 16, fontWeight: '900' }}>{money(product.price)}</Text></View></Pressable>
    </Link>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><Text style={{ color: product.in_stock ? colors.green : colors.red, fontSize: 12, fontWeight: '800' }}>{product.in_stock ? `${product.available_stock} in stock` : 'Out of stock'}</Text><View style={{ width: 120 }}><AppButton title="Add" variant="secondary" disabled={!product.in_stock} onPress={() => setMessage(add({ vendorProductId: product.vendor_product_id, productId: product.product_id, vendorId: product.vendor_id, vendorName: product.vendor_name, productName: product.product_name, unit: 'each', price: Number(product.price), availableStock: product.available_stock }) ?? 'Added to cart')} /></View></View>
    {message ? <Text style={{ fontSize: 11, color: message.startsWith('Added') ? colors.green : colors.red }}>{message}</Text> : null}
  </Card>;
}
