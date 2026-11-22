import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Card, Notice, PageHeader, Screen, SectionTitle } from '@/src/components/ui';
import { ProductCard } from '@/src/components/product-card';
import { useFavorites } from '@/src/favorites/favorites-provider';
import { searchNearbyProducts, requestLocation, type NearbyProduct, getFriendlyError } from '@/src/marketplace';
import { colors } from '@/src/theme';

export default function WishlistScreen() {
  const { items, ready, remove, sync } = useFavorites();
  const [point, setPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [offers, setOffers] = useState<Map<string, NearbyProduct>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready) return;
    if (items.length === 0) return;
    locateAndSearch();
  }, [items, ready]);

  async function locateAndSearch() {
    setLoading(true); setError('');
    try {
      const location = await requestLocation();
      setPoint(location);
      // Search for all favorited products
      const productIds = items.map(i => i.productId);
      for (const productId of productIds) {
        const results = await searchNearbyProducts('', location);
        const matching = results.find(r => r.product_id === productId);
        if (matching) {
          setOffers(prev => new Map(prev).set(productId, matching));
        }
      }
    } catch (e) {
      setError(getFriendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(productId: string) {
    await remove(productId);
    setOffers(prev => { const next = new Map(prev); next.delete(productId); return next; });
  }

  if (!ready) return <Screen><ActivityIndicator color={colors.green} /></Screen>;

  return <Screen>
    <PageHeader eyebrow="Your saved items" title="Wishlist" subtitle={`${items.length} product${items.length !== 1 ? 's' : ''} saved`} />
    
    {error ? <Notice tone="error">{error}</Notice> : null}
    
    {items.length === 0 ? (
      <Card style={{ padding: 24, alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 40 }}>♡</Text>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink }}>Your wishlist is empty</Text>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>Tap the heart icon on any product to save it for later.</Text>
        <Link href="/(tabs)/search"><Text style={{ color: colors.green, fontWeight: '800', marginTop: 8 }}>Browse products ›</Text></Link>
      </Card>
    ) : (
      <View style={{ gap: 11 }}>
        {items.map((item) => {
          const offer = offers.get(item.productId);
          return <WishlistItem key={item.productId} item={item} offer={offer} onRemove={handleRemove} />;
        })}
      </View>
    )}
  </Screen>;
}

function WishlistItem({ item, offer, onRemove }: { item: any; offer: NearbyProduct | undefined; onRemove: (id: string) => void }) {
  return <Card>
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink }}>{item.productName}</Text>
        {offer ? (
          <>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{offer.vendor_name} · Rs. {offer.price}</Text>
            <Text style={{ color: offer.in_stock ? colors.green : colors.red, fontSize: 12, fontWeight: '800' }}>
              {offer.in_stock ? `${offer.available_stock} in stock` : 'Out of stock'}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Est. {offer.estimated_delivery_minutes} min delivery</Text>
          </>
        ) : (
          <Text style={{ color: colors.muted, fontSize: 12 }}>Loading availability...</Text>
        )}
      </View>
      <View style={{ flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
        {offer && offer.in_stock ? (
          <Link href={{ pathname: '/product/[id]', params: { id: offer.product_id, name: offer.product_name } }} asChild>
            <Pressable><Text style={{ color: colors.green, fontWeight: '800' }}>View</Text></Pressable>
          </Link>
        ) : null}
        <Pressable onPress={() => onRemove(item.productId)}>
          <Text style={{ color: colors.red, fontWeight: '800' }}>Remove</Text>
        </Pressable>
      </View>
    </View>
  </Card>;
}
