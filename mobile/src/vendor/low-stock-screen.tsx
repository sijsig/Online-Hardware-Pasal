import { useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View, Switch } from 'react-native';
import { Link, router } from 'expo-router';
import { AppButton, Card, Field, Notice, PageHeader, Screen, SectionTitle } from '@/src/components/ui';
import { useAuth } from '@/src/auth/auth-provider';
import { supabase } from '@/src/lib/supabase';
import { colors, spacing, radius } from '@/src/theme';
import { money } from '@/src/marketplace';
import { LowStockProvider, useLowStockAlerts, LowStockAlert, LowStockSettings } from './low-stock-alerts';

type AlertItem = LowStockAlert & { product_name: string };

function LowStockContent() {
  const { session } = useAuth();
  const { alerts, settings, loading, error, refresh, updateSettings, dismissAlert } = useLowStockAlerts();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    refresh().finally(() => setRefreshing(false));
  };

  const handleThresholdChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      updateSettings({ threshold: num });
    }
  };

  const togglePush = (enabled: boolean) => {
    updateSettings({ notify_via_push: enabled });
  };

  const toggleEmail = (enabled: boolean) => {
    updateSettings({ notify_via_email: enabled });
  };

  const toggleEnabled = (enabled: boolean) => {
    updateSettings({ enabled });
  };

  useEffect(() => {
    if (session?.user.id) {
      refresh();
    }
  }, [session, refresh]);

  if (!session) {
    return (
      <Screen>
        <PageHeader title="Low Stock Alerts" subtitle="Sign in to monitor inventory" />
        <AppButton title="Sign in" onPress={() => router.push('/login')} />
      </Screen>
    );
  }

  const criticalAlerts = alerts.filter((a) => a.current_stock === 0);
  const lowAlerts = alerts.filter((a) => a.current_stock > 0 && a.current_stock <= settings.threshold);

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <PageHeader eyebrow="Inventory" title="Low Stock Alerts" subtitle="Get notified when products need restocking" />

      {error ? <Notice tone="error">{error}</Notice> : null}

      {/* Settings Card */}
      <Card>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink, marginBottom: spacing.md }}>
          Alert Settings
        </Text>
        
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
          <Text style={{ color: colors.ink, fontWeight: '700' }}>Enable Alerts</Text>
          <Switch value={settings.enabled} onValueChange={toggleEnabled} trackColor={{ false: colors.line, true: colors.green }} thumbColor={colors.white} />
        </View>

        <Field
          label="Stock Threshold"
          value={String(settings.threshold)}
          onChangeText={handleThresholdChange}
          keyboardType="number-pad"
          placeholder="10"
          style={{ marginBottom: spacing.md }}
        />
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: spacing.md }}>
          Alert when stock falls at or below this quantity
        </Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
          <Text style={{ color: colors.ink, fontWeight: '700' }}>Push Notifications</Text>
          <Switch value={settings.notify_via_push} onValueChange={togglePush} trackColor={{ false: colors.line, true: colors.green }} thumbColor={colors.white} disabled={!settings.enabled} />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.ink, fontWeight: '700' }}>Email Notifications</Text>
          <Switch value={settings.notify_via_email} onValueChange={toggleEmail} trackColor={{ false: colors.line, true: colors.green }} thumbColor={colors.white} disabled={!settings.enabled} />
        </View>
      </Card>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Out of Stock</Text>
          <Text style={[styles.summaryValue, { color: colors.red }]}>{criticalAlerts.length}</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Low Stock</Text>
          <Text style={[styles.summaryValue, { color: colors.amber }]}>{lowAlerts.length}</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Alerts</Text>
          <Text style={styles.summaryValue}>{alerts.length}</Text>
        </Card>
      </View>

      {/* Alerts List */}
      <SectionTitle title={alerts.length ? `Alerts (${alerts.length})` : 'No Alerts'} />
      
      {loading ? (
        <Card><Text style={{ textAlign: 'center', color: colors.muted }}>Loading alerts...</Text></Card>
      ) : alerts.length === 0 ? (
        <Card style={{ backgroundColor: colors.greenSoft }}>
          <Text style={{ color: colors.green, textAlign: 'center', fontWeight: '700' }}>✓ All products are well stocked!</Text>
        </Card>
      ) : (
        <ScrollView contentContainerStyle={{ gap: 8 }}>
          {criticalAlerts.length > 0 && (
            <Text style={{ color: colors.red, fontWeight: '800', fontSize: 14, marginTop: spacing.sm }}>OUT OF STOCK</Text>
          )}
          {criticalAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onDismiss={dismissAlert} isCritical />
          ))}
          {lowAlerts.length > 0 && (
            <Text style={{ color: colors.amber, fontWeight: '800', fontSize: 14, marginTop: spacing.sm }}>LOW STOCK</Text>
          )}
          {lowAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onDismiss={dismissAlert} />
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

function AlertCard({ alert, onDismiss, isCritical = false }: { alert: AlertItem; onDismiss: (id: string) => void; isCritical?: boolean }) {
  return (
    <Card style={{ ...styles.alertCard, ...(isCritical ? styles.alertCardCritical : {}) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...styles.alertName, ...(isCritical ? styles.alertNameCritical : {}) }}>{alert.product_name}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: 4, flexWrap: 'wrap' }}>
            <Text style={[
              styles.alertBadge,
              isCritical ? styles.badgeOutOfStock : styles.badgeLowStock,
            ]}>
              {isCritical ? 'Out of Stock' : `${alert.current_stock} left`}
            </Text>
            {alert.vendor_sku && (
              <Text style={styles.alertBadge}>
                SKU: {alert.vendor_sku}
              </Text>
            )}
          </View>
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
            Threshold: {alert.threshold} · Updated: {new Date(alert.updated_at).toLocaleDateString()}
          </Text>
        </View>
        <View style={{ minWidth: 80 }}>
          <AppButton title="Dismiss" variant="quiet" onPress={() => onDismiss(alert.id)} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    padding: spacing.md,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.ink,
    marginTop: 4,
  },
  alertCard: {
    borderWidth: 1,
    borderColor: colors.line,
  },
  alertCardCritical: {
    borderColor: colors.red,
    backgroundColor: colors.redSoft,
  },
  alertName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  alertNameCritical: {
    color: colors.red,
  },
  alertBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeOutOfStock: {
    backgroundColor: colors.redSoft,
    color: colors.red,
  },
  badgeLowStock: {
    backgroundColor: colors.amberSoft,
    color: colors.amber,
  },
});

import { StyleSheet } from 'react-native';

export default function LowStockScreen() {
  return (
    <LowStockProvider>
      <LowStockContent />
    </LowStockProvider>
  );
}
