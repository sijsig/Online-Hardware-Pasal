import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { AppButton, Card, Field, Notice, PageHeader, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/auth/auth-provider';
import { useCart } from '@/src/cart/cart-provider';
import { getFriendlyError, money, requestLocation, type Coordinates } from '@/src/marketplace';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme';

type SavedAddress = { id: string; label: string; recipient_name: string; phone: string; address_line: string; city: string; district: string | null; is_default: boolean };

export default function CheckoutScreen() {
  const { session } = useAuth(); const cart = useCart();
  const [recipient, setRecipient] = useState(''); const [phone, setPhone] = useState(''); const [address, setAddress] = useState(''); const [city, setCity] = useState('Kathmandu'); const [district, setDistrict] = useState(''); const [province, setProvince] = useState(''); const [label, setLabel] = useState('Home');
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]); const [selectedAddressId, setSelectedAddressId] = useState(''); const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [point, setPoint] = useState<Coordinates | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    if (!session) { setSavedAddresses([]); setSelectedAddressId(''); return; }
    let active = true; setLoadingAddresses(true);
    void (async () => {
      try {
        const { data, error: queryError } = await supabase.from('addresses').select('id,label,recipient_name,phone,address_line,city,district,is_default').order('is_default', { ascending: false }).order('created_at', { ascending: false }).limit(20);
        if (!active) return;
        if (queryError) setError(getFriendlyError(queryError));
        else { const list = (data ?? []) as SavedAddress[]; setSavedAddresses(list); setSelectedAddressId(list.find((item) => item.is_default)?.id ?? ''); }
      } catch (e) { if (active) setError(getFriendlyError(e)); }
      finally { if (active) setLoadingAddresses(false); }
    })();
    return () => { active = false; };
  }, [session]);
  async function saveLocation() { try { setPoint(await requestLocation()); setError(''); } catch (e) { setError(getFriendlyError(e)); } }
  async function placeOrder() {
    if (!session) { router.push('/login'); return; }
    if (!cart.items.length) { router.replace('/(tabs)/cart'); return; }
    if (!selectedAddressId && !point) { setError('Share your location to save this new delivery address.'); return; }
    setBusy(true); setError('');
    try {
      let addressId = selectedAddressId;
      if (!addressId && point) {
        const { data: newAddressId, error: addressError } = await supabase.rpc('create_customer_address', { p_label: label, p_recipient_name: recipient, p_phone: phone, p_address_line: address, p_city: city, p_district: district || null, p_province: province || null, p_latitude: point.latitude, p_longitude: point.longitude, p_is_default: savedAddresses.length === 0 });
        if (addressError) throw addressError;
        addressId = newAddressId;
      }
      const { data: orderId, error: orderError } = await supabase.rpc('create_order', { p_vendor_id: cart.items[0].vendorId, p_address_id: addressId, p_items: cart.items.map((item) => ({ vendor_product_id: item.vendorProductId, quantity: item.quantity })), p_payment_method: 'cash_on_delivery' });
      if (orderError) throw orderError;
      cart.clear();
      router.replace({ pathname: '/(tabs)/orders', params: { placed: String(orderId) } });
    } catch (e) { setError(getFriendlyError(e)); }
    finally { setBusy(false); }
  }
  return <Screen><PageHeader eyebrow="Delivery details" title="Checkout" subtitle={`Order from ${cart.items[0]?.vendorName ?? 'your selected shop'}`} />
    {!session ? <Notice>Sign in is required to place and track an order.</Notice> : null}
    {loadingAddresses ? <Notice>Loading your saved addresses…</Notice> : savedAddresses.length ? <><Text style={{ color: colors.ink, fontWeight: '900' }}>Choose a saved address</Text>{savedAddresses.map((item) => <Card key={item.id} style={{ borderColor: selectedAddressId === item.id ? colors.green : colors.line, borderWidth: selectedAddressId === item.id ? 2 : 1 }}><Text onPress={() => { setSelectedAddressId(item.id); setError(''); }} style={{ color: colors.ink, fontWeight: '800' }}>{selectedAddressId === item.id ? '✓ ' : '○ '}{item.label}{item.is_default ? ' · Default' : ''}</Text><Text onPress={() => setSelectedAddressId(item.id)} style={{ color: colors.muted, fontSize: 12 }}>{item.recipient_name} · {item.phone}{'\n'}{item.address_line}, {item.city}{item.district ? `, ${item.district}` : ''}</Text></Card>)}<AppButton title="Add a new address" variant={selectedAddressId ? 'quiet' : 'secondary'} onPress={() => setSelectedAddressId('')} /></> : null}
    {!selectedAddressId ? <><Field label="Address label" value={label} onChangeText={setLabel} placeholder="Home, Work…" /><Field label="Recipient name" value={recipient} onChangeText={setRecipient} placeholder="Name at delivery address" autoCapitalize="words" /><Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="98XXXXXXXX" keyboardType="phone-pad" /><Field label="Delivery address" value={address} onChangeText={setAddress} placeholder="Street, ward, nearby landmark" multiline /><Field label="City / municipality" value={city} onChangeText={setCity} placeholder="Kathmandu" /><Field label="District (optional)" value={district} onChangeText={setDistrict} placeholder="Kathmandu" /><Field label="Province (optional)" value={province} onChangeText={setProvince} placeholder="Bagmati" /><AppButton title={point ? 'Location saved ✓' : 'Use current location for delivery'} variant="secondary" onPress={() => void saveLocation()} />{point ? <Text style={{ color: colors.muted, fontSize: 11 }}>Coordinates saved privately with your address.</Text> : null}</> : null}
    <Notice>Payment: Cash on delivery. Online payment becomes available only after a payment provider is securely connected.</Notice>
    <Text style={{ color: colors.ink, fontWeight: '800' }}>Items subtotal: {money(cart.subtotal)}</Text>
    <Text style={{ color: colors.muted, fontSize: 12 }}>The final delivery fee, current prices and stock are checked by the database when you place the order.</Text>
    {error ? <Notice tone="error">{error}</Notice> : null}
    <AppButton title={session ? 'Place cash on delivery order' : 'Sign in to continue'} loading={busy} disabled={!session || !cart.items.length || !selectedAddressId && (!recipient.trim() || !phone.trim() || !address.trim() || !city.trim() || !point)} onPress={() => void placeOrder()} />
  </Screen>;
}
