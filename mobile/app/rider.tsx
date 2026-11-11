import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { AppButton, Card, Field, Notice, PageHeader, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/auth/auth-provider';
import { formatDistance, getFriendlyError, money, type Coordinates } from '@/src/marketplace';
import { supabase } from '@/src/lib/supabase';
import { navigationUrl } from '@/src/maps/navigation';
import { colors } from '@/src/theme';

type Delivery = { assignment_id: string; order_id: string; assignment_status: string; order_status: string; total: number; created_at: string; customer_snapshot: Record<string, unknown>; shop_snapshot: Record<string, unknown>; distance_to_vendor_meters: number | null };
type RiderInfo = { user_id: string; status: string; application_status: string; vehicle_type: string | null };

export default function RiderScreen() {
  const { session } = useAuth(); const [rider, setRider] = useState<RiderInfo | null>(null); const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [vehicle, setVehicle] = useState('motorcycle'); const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [locating, setLocating] = useState(false); const [watchEnabled, setWatchEnabled] = useState(false);
  const load = useCallback(async () => {
    if (!session) { setBusy(false); return; }
    setBusy(true);
    try {
      const { data: info, error: riderError } = await supabase.from('riders').select('user_id,status,application_status,vehicle_type').eq('user_id', session.user.id).maybeSingle();
      if (riderError) throw riderError;
      setRider(info as RiderInfo | null);
      if (info) { const { data, error: deliveryError } = await supabase.rpc('rider_get_my_deliveries'); if (deliveryError) throw deliveryError; setDeliveries((data ?? []) as Delivery[]); }
    } catch (e) { setError(getFriendlyError(e)); }
    finally { setBusy(false); }
  }, [session]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    if (!session) return;
    const channel = supabase.channel(`mobile-rider-${session.user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_assignments', filter: `rider_id=eq.${session.user.id}` }, () => { void load(); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [session, load]);
  useEffect(() => {
    if (!watchEnabled || rider?.status !== 'available' && rider?.status !== 'busy') return;
    let subscription: Location.LocationSubscription | null = null; let active = true;
    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') { if (active) setError('Location permission is required while available for delivery.'); return; }
      subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 60000, distanceInterval: 100 }, async (location) => {
        const { error: locationError } = await supabase.rpc('rider_update_location', { p_latitude: location.coords.latitude, p_longitude: location.coords.longitude, p_accuracy_meters: location.coords.accuracy });
        if (locationError && active) setError(getFriendlyError(locationError));
      });
    })().catch((e: unknown) => active && setError(getFriendlyError(e)));
    return () => { active = false; subscription?.remove(); };
  }, [watchEnabled, rider?.status]);

  async function apply() { setError(''); const { error: rpcError } = await supabase.rpc('apply_for_rider', { p_vehicle_type: vehicle }); if (rpcError) setError(getFriendlyError(rpcError)); else await load(); }
  async function setAvailability(available: boolean) {
    setLocating(true); setError('');
    try {
      const { error: rpcError } = await supabase.rpc('rider_set_availability', { p_available: available }); if (rpcError) throw rpcError;
      if (available) {
        const permission = await Location.requestForegroundPermissionsAsync(); if (permission.status !== 'granted') { await supabase.rpc('rider_set_availability', { p_available: false }); throw new Error('Location permission is required to go available.'); }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { error: locationError } = await supabase.rpc('rider_update_location', { p_latitude: position.coords.latitude, p_longitude: position.coords.longitude, p_accuracy_meters: position.coords.accuracy });
        if (locationError) throw locationError;
        // A second availability pass dispatches any orders that arrived before the first location fix.
        const { error: dispatchError } = await supabase.rpc('rider_set_availability', { p_available: true }); if (dispatchError) throw dispatchError;
      }
      setWatchEnabled(available); await load();
    } catch (e) { setError(getFriendlyError(e)); }
    finally { setLocating(false); }
  }
  async function updateDelivery(id: string, action: 'pickup' | 'deliver') {
    const run = async (cash: boolean) => { const { error: rpcError } = await supabase.rpc('rider_update_delivery', { p_assignment_id: id, p_action: action, p_cash_collected: cash }); if (rpcError) setError(getFriendlyError(rpcError)); else await load(); };
    if (action === 'deliver') Alert.alert('Confirm cash collection', 'Confirm only after collecting the cash payment from the customer.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Cash collected', onPress: () => void run(true) }]); else await run(false);
  }
  async function navigateTo(snapshot: Record<string, unknown>, label: string) {
    const latitude = Number(snapshot.latitude); const longitude = Number(snapshot.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) { setError(`${label} location is unavailable for this delivery.`); return; }
    try { await Linking.openURL(navigationUrl({ latitude, longitude })); }
    catch (e) { setError(getFriendlyError(e)); }
  }

  if (!session) return <Screen><PageHeader title="Rider dashboard" subtitle="Sign in to manage delivery assignments." /><AppButton title="Sign in" onPress={() => router.push('/login')} /></Screen>;
  if (busy) return <Screen><ActivityIndicator color={colors.green} /></Screen>;
  if (!rider) return <Screen><PageHeader eyebrow="Delivery partner" title="Apply as a rider" subtitle="Deliver from local hardware shops to nearby customers." /><Text style={{ color: colors.ink, fontWeight: '800' }}>Vehicle</Text><View style={{ flexDirection: 'row', gap: 8 }}>{['motorcycle', 'scooter', 'bicycle', 'car', 'other'].map((item) => <Text key={item} onPress={() => setVehicle(item)} style={{ color: item === vehicle ? colors.green : colors.muted, fontWeight: '800', padding: 6 }}>{item === vehicle ? '✓ ' : ''}{item}</Text>)}</View>{error ? <Notice tone="error">{error}</Notice> : null}<AppButton title="Submit rider application" onPress={() => void apply()} /></Screen>;
  return <Screen><PageHeader eyebrow="Delivery partner" title="Your delivery shift" subtitle={`Application ${rider.application_status} · ${rider.vehicle_type ?? 'vehicle not set'}`} />
    {error ? <Notice tone="error">{error}</Notice> : null}
    {rider.application_status !== 'approved' ? <Notice>Your application is {rider.application_status}. An administrator will review it before you can receive delivery offers.</Notice> : <>
      <Card><Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900' }}>Status: {rider.status}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>While available, your location updates at a sensible interval to help dispatch nearby orders.</Text>{rider.status === 'offline' ? <AppButton title="Go available" loading={locating} onPress={() => void setAvailability(true)} /> : rider.status === 'available' ? <AppButton title="Go offline" loading={locating} variant="quiet" onPress={() => void setAvailability(false)} /> : <Text style={{ color: colors.amber, fontWeight: '800' }}>Finish your active delivery to change availability.</Text>}</Card>
      <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink }}>Delivery offers & history</Text>
      {deliveries.length ? deliveries.map((delivery) => { const customer = delivery.customer_snapshot ?? {}; const shop = delivery.shop_snapshot ?? {}; const active = ['offered', 'accepted', 'picked_up'].includes(delivery.assignment_status); const customerAddress = `${String(customer.address_line ?? '')}, ${String(customer.city ?? '')}`; return <Card key={delivery.assignment_id}><Text style={{ color: colors.ink, fontWeight: '900' }}>{String(shop.name ?? 'Hardware shop')} · {delivery.assignment_status}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Shop: {String(shop.address_line ?? '')}, {String(shop.city ?? '')}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Customer: {String(customer.recipient_name ?? 'Customer')} · {String(customer.phone ?? '')}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Deliver to: {customerAddress}</Text><Text style={{ color: colors.ink, fontWeight: '800' }}>{money(delivery.total)} COD · shop {delivery.distance_to_vendor_meters ? formatDistance(delivery.distance_to_vendor_meters) : 'nearby'}</Text>{active && delivery.assignment_status !== 'picked_up' ? <AppButton title="Navigate to shop" variant="quiet" onPress={() => void navigateTo(shop, 'Shop')} /> : null}{active && delivery.assignment_status === 'picked_up' ? <AppButton title="Navigate to customer" variant="quiet" onPress={() => void navigateTo(customer, 'Customer')} /> : null}{active && delivery.assignment_status === 'offered' ? <View style={{ flexDirection: 'row', gap: 8 }}><AppButton title="Accept" onPress={async () => { const { error: e } = await supabase.rpc('rider_accept_assignment', { p_assignment_id: delivery.assignment_id }); if (e) setError(getFriendlyError(e)); else await load(); }} /><AppButton title="Decline" variant="danger" onPress={async () => { const { error: e } = await supabase.rpc('rider_decline_assignment', { p_assignment_id: delivery.assignment_id }); if (e) setError(getFriendlyError(e)); else await load(); }} /></View> : null}{active && delivery.assignment_status === 'accepted' ? <AppButton title="Confirm pickup" disabled={delivery.order_status !== 'ready_for_pickup'} onPress={() => void updateDelivery(delivery.assignment_id, 'pickup')} /> : null}{active && delivery.assignment_status === 'picked_up' ? <AppButton title="Confirm cash collected & delivered" onPress={() => void updateDelivery(delivery.assignment_id, 'deliver')} /> : null}</Card>; }) : <Text style={{ color: colors.muted }}>No delivery offers right now. Stay available to receive nearby work.</Text>}
    </>}
  </Screen>;
}
