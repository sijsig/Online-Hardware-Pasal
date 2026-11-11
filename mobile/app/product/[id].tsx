import { useEffect, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { AppButton, Notice, PageHeader, Screen } from '@/src/components/ui';
import { ProductCard } from '@/src/components/product-card';
import { getFriendlyError, requestLocation, searchNearbyProducts, type NearbyProduct } from '@/src/marketplace';
import { colors } from '@/src/theme';

export default function ProductScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [offers, setOffers] = useState<NearbyProduct[]>([]); const [busy, setBusy] = useState(true); const [error, setError] = useState('');
  useEffect(() => { let active = true; void (async () => { try { const point = await requestLocation(); const rows = await searchNearbyProducts(name ?? '', point); if (active) setOffers(rows.filter((row) => row.product_id === id)); } catch (e) { if (active) setError(getFriendlyError(e)); } finally { if (active) setBusy(false); } })(); return () => { active = false; }; }, [id, name]);
  return <Screen><PageHeader eyebrow="Nearby shop offers" title={name ?? 'Hardware product'} subtitle="Compare real vendor prices, stock and delivery estimates." />
    {busy ? <ActivityIndicator color={colors.green} /> : error ? <><Notice tone="error">{error}</Notice><AppButton title="Search products" onPress={() => router.push('/(tabs)/search')} /></> : offers.length ? offers.map((offer) => <ProductCard key={offer.vendor_product_id} product={offer} />) : <Notice>No nearby shop has this product in stock right now.</Notice>}
  </Screen>;
}
