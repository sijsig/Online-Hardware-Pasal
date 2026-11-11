import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppButton, Field, Notice, PageHeader, Screen } from '@/src/components/ui';
import { ProductCard } from '@/src/components/product-card';
import { getFriendlyError, requestLocation, searchNearbyProducts, type Coordinates, type NearbyProduct } from '@/src/marketplace';
import { colors } from '@/src/theme';

export default function SearchScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(params.category ?? null);
  const [point, setPoint] = useState<Coordinates | null>(null);
  const [results, setResults] = useState<NearbyProduct[]>([]);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  useEffect(() => { setCategory(params.category ?? null); }, [params.category]);
  const visibleResults = useMemo(() => category ? results.filter((item) => item.category_slug === category) : results, [results, category]);

  async function locate() {
    setLoadingLocation(true); setError('');
    try { const next = await requestLocation(); setPoint(next); await runSearch(next); }
    catch (e) { setError(getFriendlyError(e)); }
    finally { setLoadingLocation(false); }
  }
  async function runSearch(location = point) {
    if (!location) { setError('Share your location to find nearby shops.'); return; }
    setLoadingSearch(true); setError(''); setSearched(true);
    try { setResults(await searchNearbyProducts(query, location)); }
    catch (e) { setError(getFriendlyError(e)); }
    finally { setLoadingSearch(false); }
  }
  return <Screen>
    <PageHeader eyebrow="Local product search" title="Find it nearby" subtitle="See live offers from shops in your delivery area." />
    <Field label="What do you need?" value={query} onChangeText={setQuery} placeholder="Try drill, screws, tap..." returnKeyType="search" onSubmitEditing={() => void runSearch()} />
    {category ? <Pressable onPress={() => setCategory(null)}><Text style={{ color: colors.green, fontWeight: '800' }}>Category filter active · Clear filter ×</Text></Pressable> : null}
    {point ? <Notice tone="success">Using your current location. Results are limited to nearby shops.</Notice> : <Notice>Share your location and we’ll find shops that can deliver to you.</Notice>}
    {error ? <Notice tone="error">{error}</Notice> : null}
    <AppButton title={point ? 'Search nearby shops' : 'Use my location and search'} loading={loadingLocation || loadingSearch} onPress={() => point ? void runSearch() : void locate()} />
    {loadingSearch ? <ActivityIndicator color={colors.green} /> : searched ? visibleResults.length ? <View style={{ gap: 11 }}><Text style={{ color: colors.muted, fontSize: 12 }}>{visibleResults.length} nearby offers, sorted by stock, distance, delivery time and price</Text>{visibleResults.map((item) => <ProductCard key={item.vendor_product_id} product={item} />)}</View> : <Notice>No nearby shop has this product in stock. Try a broader search or expand your search area.</Notice> : null}
  </Screen>;
}
