import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { AppButton, Card, Notice, PageHeader, Screen, SectionTitle } from '@/src/components/ui';
import { getCategories, getFriendlyError, type Category } from '@/src/marketplace';
import { colors } from '@/src/theme';
import { isSupabaseConfigured } from '@/src/lib/supabase';

const categoryIcons: Record<string, string> = { tools: '🔧', fasteners: '🔩', plumbing: '🚰', electrical: '💡', 'paint-supplies': '🖌️', 'building-materials': '🧱', safety: '🦺', bathroom: '🛁', 'locks-security': '🔐', gardening: '🌿' };

export default function HomeScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { getCategories().then(setCategories).catch((e: unknown) => setError(getFriendlyError(e))).finally(() => setLoading(false)); }, []);
  const mainCategories = categories.filter((category) => category.parent_id === null).slice(0, 10);
  return <Screen>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><View><Text style={{ color: colors.green, fontWeight: '900', fontSize: 15 }}>HARDWARE ONLINE PASAL</Text><Text style={{ color: colors.muted, fontSize: 11 }}>Local shops. Delivered to you.</Text></View><Link href="/(tabs)/account" style={{ fontSize: 24 }}>◉</Link></View>
    <View style={{ padding: 22, gap: 12, backgroundColor: colors.green, borderRadius: 20 }}><Text style={{ fontSize: 25, lineHeight: 31, fontWeight: '900', color: colors.white }}>Hardware nearby, made easy.</Text><Text style={{ fontSize: 13, lineHeight: 19, color: '#e5efe4' }}>Compare local shop prices and stock, then get what you need delivered.</Text><AppButton title="Find Hardware Near Me" onPress={() => router.push('/(tabs)/search')} /></View>
    {!isSupabaseConfigured ? <Notice tone="error">Connect the mobile app to Supabase by creating mobile/.env from mobile/.env.example before browsing live data.</Notice> : null}
    <SectionTitle title="Shop by category" action={<Pressable onPress={() => router.push('/(tabs)/search')}><Text style={{ color: colors.green, fontWeight: '800' }}>All items ›</Text></Pressable>} />
    {loading ? <ActivityIndicator color={colors.green} /> : error ? <Notice tone="error">{error}</Notice> : mainCategories.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>{mainCategories.map((category) => <Pressable key={category.id} onPress={() => router.push({ pathname: '/(tabs)/search', params: { category: category.slug } })} style={{ width: '48%', flexGrow: 1 }}><Card style={{ minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 10 }}><Text style={{ fontSize: 25 }}>{categoryIcons[category.slug] ?? '🧰'}</Text><Text numberOfLines={2} style={{ flex: 1, fontSize: 13, fontWeight: '800', color: colors.ink }}>{category.name}</Text></Card></Pressable>)}</View> : <Card><Text style={{ color: colors.muted }}>Categories will appear here once the database is seeded.</Text></Card>}
    <SectionTitle title="Why shop locally?" />
    <Card><Text style={{ color: colors.ink, fontWeight: '800' }}>🛍️ Real neighborhood shops</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Each shop controls its own prices and stock. Compare nearby options before adding to your cart.</Text></Card>
    <Card><Text style={{ color: colors.ink, fontWeight: '800' }}>🚚 Helpful delivery estimates</Text><Text style={{ color: colors.muted, fontSize: 12 }}>See each shop’s distance and estimated delivery time in search results.</Text></Card>
    <PageHeader eyebrow="Hardware, closer to home" title="Your local hardware run, simplified." subtitle="Find tools, fittings, electrical supplies and more from independent shops around you." />
  </Screen>;
}
