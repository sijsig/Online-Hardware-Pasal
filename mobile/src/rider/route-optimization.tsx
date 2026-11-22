import { useEffect, useState, useMemo } from 'react';
import { Alert, View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { Linking } from 'expo-linking';
import { AppButton, Card, Notice, PageHeader, Screen, SectionTitle } from '@/src/components/ui';
import { useAuth } from '@/src/auth/auth-provider';
import { supabase } from '@/src/lib/supabase';
import { formatDistance, money, navigationUrl } from '@/src/marketplace';
import { colors, spacing, radius } from '@/src/theme';
import { useOfflineMode } from './offline-mode';

type DeliveryStop = {
  assignmentId: string;
  orderId: string;
  type: 'pickup' | 'dropoff';
  sequence: number;
  address: string;
  latitude: number;
  longitude: number;
  shopName?: string;
  customerName?: string;
  total?: number;
  codAmount?: number;
  status: 'pending' | 'completed' | 'skipped';
};

export default function RouteOptimizationScreen() {
  const { session } = useAuth();
  const { isOnline } = useOfflineMode();
  const [stops, setStops] = useState<DeliveryStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadActiveDeliveries();
    getCurrentLocation();
  }, [session]);

  const getCurrentLocation = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === 'granted') {
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCurrentLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      }
    } catch (e) {
      console.warn('Could not get current location:', e);
    }
  };

  const loadActiveDeliveries = async () => {
    if (!session?.user.id) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: deliveryError } = await supabase.rpc('rider_get_my_deliveries');
      if (deliveryError) throw deliveryError;

      const activeDeliveries = (data ?? []).filter((d: any) => 
        ['offered', 'accepted', 'picked_up'].includes(d.assignment_status)
      );

      if (activeDeliveries.length === 0) {
        setStops([]);
        return;
      }

      // Build stops from active deliveries
      const newStops: DeliveryStop[] = [];
      
      for (const delivery of activeDeliveries) {
        const shop = delivery.shop_snapshot ?? {};
        const customer = delivery.customer_snapshot ?? {};
        
        // Add pickup stop if not picked up yet
        if (delivery.assignment_status !== 'picked_up') {
          newStops.push({
            assignmentId: delivery.assignment_id,
            orderId: delivery.order_id,
            type: 'pickup',
            sequence: newStops.length,
            address: `${String(shop.address_line ?? '')}, ${String(shop.city ?? '')}`,
            latitude: Number(shop.latitude) || 0,
            longitude: Number(shop.longitude) || 0,
            shopName: String(shop.name ?? 'Shop'),
            status: 'pending',
          });
        }

        // Add dropoff stop
        newStops.push({
          assignmentId: delivery.assignment_id,
          orderId: delivery.order_id,
          type: 'dropoff',
          sequence: newStops.length,
          address: `${String(customer.address_line ?? '')}, ${String(customer.city ?? '')}`,
          latitude: Number(customer.latitude) || 0,
          longitude: Number(customer.longitude) || 0,
          customerName: String(customer.recipient_name ?? 'Customer'),
          total: delivery.total,
          codAmount: delivery.cod_amount,
          status: delivery.assignment_status === 'picked_up' ? 'pending' : 'completed',
        });
      }

      // Sort by sequence
      newStops.sort((a, b) => a.sequence - b.sequence);
      setStops(newStops);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  };

  const optimizeRoute = async () => {
    if (stops.length < 2) {
      Alert.alert('Not enough stops', 'Need at least 2 stops to optimize');
      return;
    }

    setOptimizing(true);
    setError('');
    setSuccess('');

    try {
      // Simple nearest neighbor optimization starting from current location
      let currentLat = currentLocation?.latitude;
      let currentLng = currentLocation?.longitude;
      
      // If no current location, use first stop
      if (!currentLat) {
        currentLat = stops[0].latitude;
        currentLng = stops[0].longitude;
      }

      const unvisited = [...stops.filter(s => s.status === 'pending')];
      const optimized: DeliveryStop[] = [];
      const completed = stops.filter(s => s.status === 'completed');

      while (unvisited.length > 0) {
        let nearestIndex = -1;
        let nearestDistance = Infinity;

        for (let i = 0; i < unvisited.length; i++) {
          const stop = unvisited[i];
          const distance = calculateDistance(currentLat!, currentLng!, stop.latitude, stop.longitude);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = i;
          }
        }

        if (nearestIndex >= 0) {
          const nextStop = unvisited.splice(nearestIndex, 1)[0];
          nextStop.sequence = optimized.length;
          optimized.push(nextStop);
          currentLat = nextStop.latitude;
          currentLng = nextStop.longitude;
        }
      }

      // Rebuild stops with optimized order
      const allStops = [
        ...completed.map((s, i) => ({ ...s, sequence: i })),
        ...optimized,
      ];

      setStops(allStops);
      setSuccess('Route optimized! Stops reordered for shortest path.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to optimize route');
    } finally {
      setOptimizing(false);
    }
  };

  const navigateToStop = async (stop: DeliveryStop) => {
    try {
      await Linking.openURL(navigationUrl({ latitude: stop.latitude, longitude: stop.longitude }));
    } catch (e) {
      setError('Could not open navigation');
    }
  };

  const markStopComplete = async (index: number) => {
    const stop = stops[index];
    if (stop.status === 'completed') return;

    const updated = [...stops];
    updated[index] = { ...stop, status: 'completed' };
    setStops(updated);

    // If it's a pickup, update delivery status
    if (stop.type === 'pickup') {
      // Could call rider_update_delivery here
    }
  };

  const totalDistance = useMemo(() => {
    let distance = 0;
    let prevLat = currentLocation?.latitude;
    let prevLng = currentLocation?.longitude;
    
    if (!prevLat && stops.length > 0) {
      prevLat = stops[0].latitude;
      prevLng = stops[0].longitude;
    }
    
    for (const stop of stops.filter(s => s.status === 'pending')) {
      if (prevLat && prevLng) {
        distance += calculateDistance(prevLat, prevLng, stop.latitude, stop.longitude);
      }
      prevLat = stop.latitude;
      prevLng = stop.longitude;
    }
    
    return distance;
  }, [stops, currentLocation]);

  const pendingStops = stops.filter(s => s.status === 'pending');
  const completedStops = stops.filter(s => s.status === 'completed');

  if (!session) {
    return (
      <Screen>
        <PageHeader title="Route Optimization" subtitle="Sign in to optimize delivery routes" />
        <AppButton title="Sign in" onPress={() => {}} />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader
        eyebrow="Route Optimization"
        title="Delivery Route"
        subtitle={`${pendingStops.length} pending · ${completedStops.length} completed`}
      />

      {error ? <Notice tone="error">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      {!isOnline && (
        <Card style={{ backgroundColor: colors.amberSoft, marginBottom: spacing.md }}>
          <Text style={{ color: colors.amber, fontWeight: '700' }}>⚠️ Offline mode</Text>
          <Text style={{ color: colors.ink, marginTop: 4 }}>Route changes will sync when online.</Text>
        </Card>
      )}

      {/* Summary */}
      <Card>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{pendingStops.length}</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{formatDistance(totalDistance)}</Text>
            <Text style={styles.summaryLabel}>Est. Distance</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{Math.round(totalDistance / 0.5 * 2)}</Text>
            <Text style={styles.summaryLabel}>Est. Time (min)</Text>
          </View>
        </View>
      </Card>

      {/* Actions */}
      <View style={styles.actionRow}>
        <AppButton
          title="Optimize Route"
          variant="secondary"
          loading={optimizing}
          disabled={pendingStops.length < 2 || optimizing}
          onPress={optimizeRoute}
        />
        <AppButton
          title="Refresh"
          variant="quiet"
          onPress={loadActiveDeliveries}
        />
      </View>

      {/* Stops List */}
      <SectionTitle title="Stops" />
      {stops.length === 0 ? (
        <Card>
          <Text style={{ color: colors.muted, textAlign: 'center', paddingVertical: spacing.lg }}>
            No active deliveries. Go available to receive offers.
          </Text>
        </Card>
      ) : (
        <FlatList
          data={stops}
          keyExtractor={(item) => `${item.assignmentId}-${item.type}`}
          renderItem={({ item, index }) => (
            <DeliveryStopCard
              stop={item}
              index={index}
              onNavigate={() => navigateToStop(item)}
              onComplete={() => markStopComplete(index)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </Screen>
  );
}

function DeliveryStopCard({ stop, index, onNavigate, onComplete }: { 
  stop: DeliveryStop; 
  index: number; 
  onNavigate: () => void; 
  onComplete: () => void; 
}) {
  const isPickup = stop.type === 'pickup';
  const isCompleted = stop.status === 'completed';
  
  return (
    <Card style={[styles.stopCard, isCompleted && styles.stopCardCompleted]}>
      <View style={styles.stopHeader}>
        <View style={styles.stopNumber}>
          <Text style={styles.stopNumberText}>{index + 1}</Text>
        </View>
        <View style={styles.stopTypeContainer}>
          <View style={[
            styles.stopTypeBadge,
            isPickup ? styles.badgePickup : styles.badgeDropoff,
            isCompleted && styles.badgeCompleted,
          ]}>
            <Text style={styles.stopTypeText}>{isPickup ? 'PICKUP' : 'DROPOFF'}</Text>
          </View>
          {isCompleted && <Text style={styles.completedText}>✓ Done</Text>}
        </View>
      </View>

      <View style={styles.stopDetails}>
        <Text style={styles.stopName}>{isPickup ? stop.shopName : stop.customerName}</Text>
        <Text style={styles.stopAddress}>{stop.address}</Text>
        {stop.codAmount && (
          <Text style={styles.codAmount}>COD: {money(stop.codAmount)}</Text>
        )}
        {stop.total && !isPickup && (
          <Text style={styles.orderTotal}>Order: {money(stop.total)}</Text>
        )}
      </View>

      <View style={styles.stopActions}>
        {!isCompleted && (
          <AppButton title="Navigate" variant="secondary" onPress={onNavigate} />
        )}
        {!isCompleted && (
          <AppButton title="Mark Complete" variant={isPickup ? 'primary' : 'primary'} onPress={onComplete} />
        )}
        {isCompleted && (
          <AppButton title="Completed" variant="quiet" disabled />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.ink,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  separator: {
    height: 8,
  },
  stopCard: {
    borderWidth: 1,
    borderColor: colors.line,
  },
  stopCardCompleted: {
    opacity: 0.6,
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  stopNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.green,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopNumberText: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 14,
  },
  stopTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  stopTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  badgePickup: { backgroundColor: colors.blueSoft },
  badgeDropoff: { backgroundColor: colors.amberSoft },
  badgeCompleted: { opacity: 0.5 },
  stopTypeText: {
    fontSize: 11,
    fontWeight: '800',
    color: isPickup ? colors.blue : colors.amber,
  },
  completedText: {
    color: colors.green,
    fontWeight: '800',
    fontSize: 12,
  },
  stopDetails: {
    gap: 2,
    marginBottom: spacing.sm,
  },
  stopName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  stopAddress: {
    fontSize: 12,
    color: colors.muted,
  },
  codAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.amber,
  },
  orderTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  stopActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});

// Helper function
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
