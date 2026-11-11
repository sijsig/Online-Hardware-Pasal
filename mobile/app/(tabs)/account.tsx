import { Text } from 'react-native';
import { router } from 'expo-router';
import { AppButton, Card, Notice, PageHeader, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/auth/auth-provider';
import { colors } from '@/src/theme';

export default function AccountScreen() {
  const { session, profile, signOut } = useAuth();
  return <Screen><PageHeader eyebrow="Hardware Online Pasal" title="Account" subtitle="Your profile and marketplace tools." />
    {session ? <><Card><Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900' }}>{profile?.full_name || session.user.email}</Text><Text style={{ color: colors.muted }}>{profile?.phone || 'Add a phone number from your profile settings.'}</Text><Text style={{ color: colors.green, fontWeight: '800', textTransform: 'capitalize' }}>{profile?.role?.replace('_', ' ') ?? 'Loading role'}</Text></Card>
      {profile?.role === 'vendor_owner' || profile?.role === 'vendor_staff' ? <AppButton title="Open shop dashboard" onPress={() => router.push('/vendor')} /> : null}
      {profile?.role === 'customer' ? <AppButton title="Apply to sell as a shop" variant="quiet" onPress={() => router.push('/vendor-apply')} /> : null}
      {profile?.role === 'rider' ? <AppButton title="Open rider dashboard" onPress={() => router.push('/rider')} /> : null}
      {profile?.role === 'admin' ? <AppButton title="Open admin review queue" onPress={() => router.push('/admin')} /> : null}
      <AppButton title="Sign out" variant="quiet" onPress={() => void signOut()} />
    </> : <><Notice>Sign in to place orders and keep your delivery updates together.</Notice><AppButton title="Sign in or create account" onPress={() => router.push('/login')} /></>}
    <Card><Text style={{ color: colors.ink, fontWeight: '800' }}>Delivery & privacy</Text><Text style={{ color: colors.muted, fontSize: 12 }}>We use your location only to find nearby shops and calculate delivery distance. You can review location permissions in phone settings.</Text></Card>
  </Screen>;
}
