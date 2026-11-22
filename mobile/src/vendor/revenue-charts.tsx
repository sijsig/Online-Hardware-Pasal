import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/auth/auth-provider';
import { colors, spacing, radius } from '@/src/theme';

export type RevenueDataPoint = {
  label: string;
  value: number;
  date: string;
};

export type RevenuePeriod = 'daily' | 'weekly' | 'monthly';

interface RevenueChartProps {
  period?: RevenuePeriod;
  height?: number;
  width?: number;
}

function getPeriodLabel(period: RevenuePeriod, date: string): string {
  const d = new Date(date);
  switch (period) {
    case 'daily':
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    case 'weekly':
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    case 'monthly':
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function RevenueChart({ period = 'monthly', height = 200, width = 300 }: RevenueChartProps) {
  const { session } = useAuth();
  const [data, setData] = useState<RevenueDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<RevenuePeriod>(period);

  useEffect(() => {
    async function loadRevenue() {
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
          setData([]);
          setLoading(false);
          return;
        }

        let query = supabase
          .from('commissions')
          .select('vendor_payout, created_at')
          .eq('vendor_id', shop.id)
          .eq('status', 'earned')
          .order('created_at', { ascending: true });

        // Filter by period
        const now = new Date();
        let startDate: Date;
        
        switch (selectedPeriod) {
          case 'daily':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
            break;
          case 'weekly':
            startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
            break;
          case 'monthly':
            startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
            break;
        }
        
        query = query.gte('created_at', startDate.toISOString());

        const { data: commissions, error: commError } = await query;
        if (commError) throw commError;

        // Aggregate by period
        const aggregated = new Map<string, number>();
        
        (commissions ?? []).forEach((c) => {
          const key = getPeriodLabel(selectedPeriod, c.created_at);
          aggregated.set(key, (aggregated.get(key) ?? 0) + Number(c.vendor_payout));
        });

        // Fill in missing periods with 0
        const result: RevenueDataPoint[] = [];
        const periodsToShow = selectedPeriod === 'daily' ? 30 : selectedPeriod === 'weekly' ? 12 : 12;
        
        for (let i = periodsToShow - 1; i >= 0; i--) {
          let date: Date;
          let label: string;
          
          if (selectedPeriod === 'daily') {
            date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            label = getPeriodLabel('daily', date.toISOString());
          } else if (selectedPeriod === 'weekly') {
            date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            label = getPeriodLabel('weekly', date.toISOString());
          } else {
            date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            label = getPeriodLabel('monthly', date.toISOString());
          }
          
          result.push({
            label,
            value: aggregated.get(label) ?? 0,
            date: date.toISOString(),
          });
        }

        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load revenue data');
      } finally {
        setLoading(false);
      }
    }

    loadRevenue();
  }, [session, selectedPeriod]);

  const maxValue = useMemo(() => Math.max(...data.map(d => d.value), 1), [data]);
  const totalRevenue = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);
  const avgRevenue = useMemo(() => data.length ? totalRevenue / data.length : 0, [totalRevenue, data.length]);

  if (loading) {
    return (
      <View style={styles.chartContainer}>
        <Text style={styles.loadingText}>Loading revenue data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.chartContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const barWidth = (typeof width === 'number' ? width : 300) / data.length;
  const barMaxHeight = height - 40;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Revenue Overview</Text>
        <View style={styles.periodTabs}>
          {(['daily', 'weekly', 'monthly'] as RevenuePeriod[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.periodTab,
                selectedPeriod === p && styles.periodTabActive,
              ]}
              onPress={() => setSelectedPeriod(p)}
            >
              <Text style={[
                styles.periodTabText,
                selectedPeriod === p && styles.periodTabTextActive,
              ]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Revenue</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalRevenue)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Avg per Period</Text>
          <Text style={styles.summaryValue}>{formatCurrency(avgRevenue)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Periods</Text>
          <Text style={styles.summaryValue}>{data.length}</Text>
        </View>
      </View>

      <View style={[styles.chartContainer, { height }]}>
        <View style={styles.chartWrapper}>
          {data.map((point, index) => {
            const barHeight = maxValue > 0 ? (point.value / maxValue) * barMaxHeight : 0;
            return (
              <View key={index} style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    { height: Math.max(barHeight, point.value > 0 ? 2 : 0) },
                  ]}
                />
                <Text style={styles.barLabel}>{point.label}</Text>
                <Text style={styles.barValue}>{formatCurrency(point.value)}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.xAxis} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.ink,
  },
  periodTabs: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  periodTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.canvas,
  },
  periodTabActive: {
    backgroundColor: colors.greenSoft,
  },
  periodTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  periodTabTextActive: {
    color: colors.green,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.ink,
  },
  chartContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  chartWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: '100%',
    paddingBottom: 20,
  },
  barContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    minWidth: 30,
  },
  bar: {
    width: '60%',
    backgroundColor: colors.green,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 0,
  },
  barLabel: {
    fontSize: 8,
    color: colors.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  barValue: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  xAxis: {
    height: 1,
    backgroundColor: colors.line,
    marginTop: -20,
  },
  loadingText: {
    color: colors.muted,
    textAlign: 'center',
  },
  errorText: {
    color: colors.red,
    textAlign: 'center',
  },
});
