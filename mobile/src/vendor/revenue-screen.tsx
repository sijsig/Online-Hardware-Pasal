import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { AppButton, Card, Notice, PageHeader, Screen, SectionTitle } from '@/src/components/ui';
import { useAuth } from '@/src/auth/auth-provider';
import { supabase } from '@/src/lib/supabase';
import { colors, spacing, radius } from '@/src/theme';
import { money } from '@/src/marketplace';
import { RevenueChart } from './revenue-charts';

export type RevenueDataPoint = {
  label: string;
  value: number;
  date: string;
};

export type RevenuePeriod = 'daily' | 'weekly' | 'monthly';

function RevenueContent() {
  const { session } = useAuth();
  const [summary, setSummary] = useState<{
    today: number;
    thisWeek: number;
    thisMonth: number;
    total: number;
    pending: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = async () => {
    if (!session?.user.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', session.user.id)
        .maybeSingle();
      
      if (shopError) throw shopError;
      if (!shop) {
        setSummary({ today: 0, thisWeek: 0, thisMonth: 0, total: 0, pending: 0 });
        return;
      }

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data: commissions, error: commError } = await supabase
        .from('commissions')
        .select('vendor_payout, status, created_at')
        .eq('vendor_id', shop.id)
        .order('created_at', { ascending: true });

      if (commError) throw commError;

      let today = 0, thisWeek = 0, thisMonth = 0, total = 0, pending = 0;

      (commissions ?? []).forEach((c) => {
        const amount = Number(c.vendor_payout);
        const createdAt = new Date(c.created_at);
        total += amount;
        
        if (c.status === 'earned') pending += amount;
        if (createdAt >= todayStart) today += amount;
        if (createdAt >= weekStart) thisWeek += amount;
        if (createdAt >= monthStart) thisMonth += amount;
      });

      setSummary({ today, thisWeek, thisMonth, total, pending });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load revenue summary');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadSummary();
  };

  useEffect(() => {
    if (session?.user.id) {
      loadSummary();
    }
  }, [session]);

  if (!session) {
    return (
      <Screen>
        <PageHeader title="Revenue Analytics" subtitle="Sign in to view your earnings" />
        <AppButton title="Sign in" onPress={() => router.push('/login')} />
      </Screen>
    );
  }

  if (loading) {
    return <Screen><Text style={{ textAlign: 'center', marginTop: 50, color: colors.muted }}>Loading...</Text></Screen>;
  }

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <PageHeader eyebrow="Financials" title="Revenue Analytics" subtitle="Track your shop's earnings over time" />

      {error ? <Notice tone="error">{error}</Notice> : null}

      {/* Summary Cards */}
      {summary && (
        <View style={styles.summaryGrid}>
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Today</Text>
            <Text style={styles.summaryValue}>{money(summary.today)}</Text>
          </Card>
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>This Week</Text>
            <Text style={styles.summaryValue}>{money(summary.thisWeek)}</Text>
          </Card>
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>This Month</Text>
            <Text style={styles.summaryValue}>{money(summary.thisMonth)}</Text>
          </Card>
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>All Time</Text>
            <Text style={styles.summaryValue}>{money(summary.total)}</Text>
          </Card>
          <Card style={{ ...styles.summaryCard, ...styles.summaryCardHighlight }}>
            <Text style={styles.summaryLabel}>Pending Payout</Text>
            <Text style={[styles.summaryValue, { color: colors.amber }]}>{money(summary.pending)}</Text>
          </Card>
        </View>
      )}

      {/* Charts */}
      <SectionTitle title="Revenue Trends" />
      <RevenueChart period="daily" height={220} />
      
      <View style={{ marginTop: spacing.lg }}>
        <SectionTitle title="Weekly Overview" />
      </View>
      <RevenueChart period="weekly" height={220} />
      
      <View style={{ marginTop: spacing.lg }}>
        <SectionTitle title="Monthly Overview" />
      </View>
      <RevenueChart period="monthly" height={220} />

      {/* Top Products */}
      <View style={{ marginTop: spacing.lg }}>
        <SectionTitle title="Top Selling Products" />
      </View>
      <TopProductsChart />
    </Screen>
  );
}

function TopProductsChart() {
  const { session } = useAuth();
  const [products, setProducts] = useState<Array<{ name: string; revenue: number; orders: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTopProducts() {
      if (!session?.user.id) return;
      setLoading(true);
      try {
        const { data: shop } = await supabase
          .from('shops')
          .select('id')
          .eq('owner_id', session.user.id)
          .maybeSingle();
        
        if (!shop) return;

        // Get order items for this vendor's orders
        const { data: orderItems, error } = await supabase
          .from('order_items')
          .select(`
            quantity,
            unit_price,
            total_price,
            products!inner(name),
            orders!inner(shop_id, status)
          `)
          .eq('orders.shop_id', shop.id)
          .in('orders.status', ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'delivered']);

        if (error) throw error;

        // Aggregate by product
        const productMap = new Map<string, { revenue: number; orders: number; name: string }>();
        
        (orderItems ?? []).forEach((item: any) => {
          const productName = item.products?.name ?? 'Unknown';
          const existing = productMap.get(productName) ?? { revenue: 0, orders: 0, name: productName };
          existing.revenue += Number(item.total_price);
          existing.orders += 1;
          productMap.set(productName, existing);
        });

        const sorted = Array.from(productMap.values())
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10);

        setProducts(sorted);
      } catch (e) {
        console.error('Failed to load top products:', e);
      } finally {
        setLoading(false);
      }
    }

    loadTopProducts();
  }, [session]);

  if (loading) {
    return <Card><Text style={{ textAlign: 'center', color: colors.muted }}>Loading...</Text></Card>;
  }

  if (products.length === 0) {
    return <Card><Text style={{ textAlign: 'center', color: colors.muted }}>No sales data yet</Text></Card>;
  }

  const maxRevenue = Math.max(...products.map(p => p.revenue), 1);

  return (
    <Card>
      {products.map((product, index) => (
        <View key={index} style={styles.productRow}>
          <View style={styles.productInfo}>
            <Text style={styles.productRank}>#{index + 1}</Text>
            <View>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productOrders}>{product.orders} orders</Text>
            </View>
          </View>
          <View style={styles.productRevenueContainer}>
            <View style={[
              styles.productRevenueBar,
              { width: `${(product.revenue / maxRevenue) * 100}%` },
            ]} />
            <Text style={styles.productRevenue}>{money(product.revenue)}</Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  summaryCard: {
    flex: 1,
    minWidth: '30%',
    padding: spacing.md,
  },
  summaryCardHighlight: {
    backgroundColor: colors.amberSoft,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.ink,
    marginTop: 4,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  productInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  productRank: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted,
    width: 24,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  productOrders: {
    fontSize: 11,
    color: colors.muted,
  },
  productRevenueContainer: {
    alignItems: 'flex-end',
    minWidth: 100,
  },
  productRevenueBar: {
    height: 6,
    backgroundColor: colors.green,
    borderRadius: 3,
    marginBottom: 2,
  },
  productRevenue: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink,
  },
});

import { StyleSheet } from 'react-native';

export default function RevenueScreen() {
  return <RevenueContent />;
}
