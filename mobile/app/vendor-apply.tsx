import { useState } from 'react';
import { router } from 'expo-router';
import { AppButton, Field, Notice, PageHeader, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/auth/auth-provider';
import { getFriendlyError, requestLocation, type Coordinates } from '@/src/marketplace';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme';
import { Text } from 'react-native';

export default function VendorApplyScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const [shopName, setShopName] = useState(''); const [phone, setPhone] = useState(profile?.phone ?? ''); const [address, setAddress] = useState('');
  const [city, setCity] = useState(''); const [district, setDistrict] = useState(''); const [province, setProvince] = useState(''); const [description, setDescription] = useState('');
  const [point, setPoint] = useState<Coordinates | null>(null); const [locating, setLocating] = useState(false); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(''); const [success, setSuccess] = useState('');

  async function chooseLocation() {
    setLocating(true); setError('');
    try { setPoint(await requestLocation()); }
    catch (e) { setError(getFriendlyError(e)); }
    finally { setLocating(false); }
  }

  async function submit() {
    if (!session) { router.push('/login'); return; }
    if (!point) { setError('Set your shop location before submitting the application.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const { error: rpcError } = await supabase.rpc('apply_for_vendor_shop', {
        p_name: shopName.trim(), p_phone: phone.trim(), p_email: session.user.email ?? null,
        p_address_line: address.trim(), p_city: city.trim(), p_district: district.trim() || null,
        p_province: province.trim() || null, p_description: description.trim() || null,
        p_latitude: point.latitude, p_longitude: point.longitude,
      });
      if (rpcError) throw rpcError;
      await refreshProfile();
      setSuccess('Application submitted. An administrator will review your shop.');
      router.replace('/vendor');
    } catch (e) { setError(getFriendlyError(e)); }
    finally { setSaving(false); }
  }

  if (!session) return <Screen><PageHeader title="Apply as a shop" subtitle="Sign in or create a customer account first. The same account will be linked to your shop." /><AppButton title="Sign in or create account" onPress={() => router.push('/login')} /></Screen>;
  if (profile && profile.role !== 'customer') return <Screen><PageHeader title="Shop application" subtitle="This account already has a marketplace role." /><Notice>Use the account dashboard for your current role, or contact support if you think this is a mistake.</Notice><AppButton title="Back to account" variant="quiet" onPress={() => router.back()} /></Screen>;

  return <Screen><PageHeader eyebrow="For local hardware shops" title="Apply to sell" subtitle="Tell us about your shop. Your application is reviewed before customers can order from you." />
    <Notice>Submitting an application does not publish products or guarantee approval. You can manage inventory after the shop is approved.</Notice>
    <Field label="Shop name" value={shopName} onChangeText={setShopName} placeholder="e.g. Sijan Hardware" autoCapitalize="words" />
    <Field label="Shop phone" value={phone} onChangeText={setPhone} placeholder="98XXXXXXXX" keyboardType="phone-pad" />
    <Field label="Street address" value={address} onChangeText={setAddress} placeholder="Tole, road, or landmark" />
    <Field label="City / municipality" value={city} onChangeText={setCity} placeholder="Kathmandu" />
    <Field label="District (optional)" value={district} onChangeText={setDistrict} placeholder="Kathmandu" />
    <Field label="Province (optional)" value={province} onChangeText={setProvince} placeholder="Bagmati" />
    <Field label="About your shop (optional)" value={description} onChangeText={setDescription} placeholder="Products and services you offer" multiline />
    <AppButton title={point ? 'Shop location saved' : 'Use current location for shop'} variant={point ? 'secondary' : 'quiet'} loading={locating} onPress={() => void chooseLocation()} />
    {point ? <Text style={{ color: colors.muted, fontSize: 12 }}>Location captured: {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</Text> : null}
    {error ? <Notice tone="error">{error}</Notice> : null}{success ? <Notice tone="success">{success}</Notice> : null}
    <AppButton title="Submit shop application" loading={saving} disabled={!shopName.trim() || !phone.trim() || !address.trim() || !city.trim() || !point} onPress={() => void submit()} />
  </Screen>;
}
