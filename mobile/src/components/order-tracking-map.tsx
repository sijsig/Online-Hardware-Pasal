import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { MapView, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { AppButton, Card } from '@/src/components/ui';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme';

interface OrderTrackingMapProps {
  orderId: string;
  riderLocation: { latitude: number; longitude: number; location_updated_at: string } | null;
  assignmentStatus: string;
  deliveryAddress: { latitude?: number; longitude?: number; address_line?: string };
  vendorLocation?: { latitude: number; longitude: number; name: string } | null;
}

export function OrderTrackingMap({ orderId, riderLocation, assignmentStatus, deliveryAddress, vendorLocation }: OrderTrackingMapProps) {
  const mapRef = useRef<any>(null);
  const [region, setRegion] = useState<{ latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null>(null);
  const [showMap, setShowMap] = useState(false);

  // Calculate region to fit all markers
  useEffect(() => {
    const points: { latitude: number; longitude: number }[] = [];
    
    if (riderLocation) points.push({ latitude: riderLocation.latitude, longitude: riderLocation.longitude });
    if (deliveryAddress.latitude && deliveryAddress.longitude) points.push({ latitude: deliveryAddress.latitude, longitude: deliveryAddress.longitude });
    if (vendorLocation) points.push({ latitude: vendorLocation.latitude, longitude: vendorLocation.longitude });

    if (points.length > 0) {
      const minLat = Math.min(...points.map(p => p.latitude));
      const maxLat = Math.max(...points.map(p => p.latitude));
      const minLon = Math.min(...points.map(p => p.longitude));
      const maxLon = Math.max(...points.map(p => p.longitude));

      const centerLat = (minLat + maxLat) / 2;
      const centerLon = (minLon + maxLon) / 2;
      const latDelta = Math.max((maxLat - minLat) * 1.5, 0.01);
      const lonDelta = Math.max((maxLon - minLon) * 1.5, 0.01);

      setRegion({ latitude: centerLat, longitude: centerLon, latitudeDelta: latDelta, longitudeDelta: lonDelta });
      setShowMap(true);
    } else {
      setShowMap(false);
    }
  }, [riderLocation, deliveryAddress, vendorLocation]);

  if (!showMap || !region) return null;

  return (
    <Card style={{ overflow: 'hidden', marginTop: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <Text style={{ fontWeight: '800', color: colors.ink }}>Live Delivery Map</Text>
        <Text style={{ fontSize: 11, color: colors.muted }}>
          Updated {riderLocation ? new Date(riderLocation.location_updated_at).toLocaleTimeString() : '—'}
        </Text>
      </View>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        region={region}
        style={{ width: '100%', height: 300 }}
        showsUserLocation={false}
        showsMyLocationButton={true}
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        {/* Vendor/Shop marker */}
        {vendorLocation && (
          <Marker
            coordinate={{ latitude: vendorLocation.latitude, longitude: vendorLocation.longitude }}
            title={vendorLocation.name}
            description="Shop / Pickup point"
            pinColor={colors.green}
          >
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'white' }}>
              <Text style={{ color: 'white', fontSize: 14, fontWeight: '900' }}>🏪</Text>
            </View>
          </Marker>
        )}

        {/* Rider marker */}
        {riderLocation && (
          <Marker
            coordinate={{ latitude: riderLocation.latitude, longitude: riderLocation.longitude }}
            title="Your Rider"
            description={`Last update: ${new Date(riderLocation.location_updated_at).toLocaleTimeString()}`}
            pinColor={colors.blue}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.blue, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'white' }}>
              <Text style={{ color: 'white', fontSize: 18 }}>🛵</Text>
            </View>
          </Marker>
        )}

        {/* Delivery address marker */}
        {deliveryAddress.latitude && deliveryAddress.longitude && (
          <Marker
            coordinate={{ latitude: deliveryAddress.latitude, longitude: deliveryAddress.longitude }}
            title="Delivery address"
            description={deliveryAddress.address_line ?? 'Your location'}
            pinColor={colors.red}
          >
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.red, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'white' }}>
              <Text style={{ color: 'white', fontSize: 14, fontWeight: '900' }}>🏠</Text>
            </View>
          </Marker>
        )}
      </MapView>
      <View style={{ padding: 12, gap: 8, flexDirection: 'row', flexWrap: 'wrap' }}>
        <AppButton title="Open in Maps" variant="secondary" onPress={() => {
          if (riderLocation) {
            void Linking.openURL(`https://maps.google.com/?q=${riderLocation.latitude},${riderLocation.longitude}`);
          } else {
            Alert.alert('No rider location yet');
          }
        }} />
      </View>
    </Card>
  );
}

// Hook to subscribe to live rider location updates
export function useRiderLocation(orderId: string, assignmentStatus: string) {
  const [riderLocation, setRiderLocation] = useState<{ latitude: number; longitude: number; location_updated_at: string } | null>(null);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    if (!['accepted', 'picked_up'].includes(assignmentStatus)) {
      setRiderLocation(null);
      return;
    }

    let alive = true;
    let interval: ReturnType<typeof setInterval>;

    async function fetchLocation() {
      try {
        const { data, error } = await supabase.rpc('customer_get_order_rider_location', { p_order_id: orderId });
        if (error) throw error;
        if (!alive) return;
        const location = ((data ?? []) as { latitude: number; longitude: number; location_updated_at: string }[])[0] ?? null;
        if (location) setRiderLocation(location);
        setLocationError('');
      } catch (e: any) {
        if (alive) setLocationError(e.message);
      }
    }

    // Initial fetch
    void fetchLocation();
    // Poll every 15 seconds for live updates
    interval = setInterval(() => void fetchLocation(), 15000);

    return () => { alive = false; clearInterval(interval); };
  }, [orderId, assignmentStatus]);

  return { riderLocation, locationError };
}
