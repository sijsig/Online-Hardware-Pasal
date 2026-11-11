import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { supabase } from '@/src/lib/supabase';

export type MarketplaceRole = 'customer' | 'vendor_owner' | 'vendor_staff' | 'rider' | 'admin';
export type Profile = { id: string; full_name: string | null; phone: string | null; role: MarketplaceRole };

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  ready: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase.from('profiles').select('id, full_name, phone, role').eq('id', userId).maybeSingle();
    if (error) {
      console.warn('Profile lookup failed:', error.message);
      setProfile(null);
      return;
    }
    setProfile(data as Profile | null);
  }

  useEffect(() => {
    let alive = true;
    async function completeDeepLink(url: string) {
      if (Platform.OS === 'web') return;
      const code = Linking.parse(url).queryParams?.code;
      if (typeof code !== 'string') return;
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error && alive) console.warn('Could not complete the email sign-in link:', error.message);
    }
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => { void completeDeepLink(url); });
    void Linking.getInitialURL().then((url) => { if (url) return completeDeepLink(url); }).catch((error: unknown) => {
      if (alive) console.warn('Could not read the initial sign-in link:', error instanceof Error ? error.message : 'Unknown error');
    });
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session?.user.id) await loadProfile(data.session.user.id);
      if (alive) setReady(true);
    }).catch((error: unknown) => {
      console.warn('Could not restore mobile sign-in:', error);
      if (alive) setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive) return;
      setSession(nextSession);
      if (nextSession?.user.id) {
        queueMicrotask(() => { if (alive) void loadProfile(nextSession.user.id); });
      } else setProfile(null);
      setReady(true);
    });
    return () => { alive = false; subscription.unsubscribe(); linkingSubscription.remove(); };
  }, []);

  const value = useMemo<AuthState>(() => ({
    session,
    profile,
    ready,
    async refreshProfile() { if (session?.user.id) await loadProfile(session.user.id); },
    async signOut() { await supabase.auth.signOut(); },
  }), [session, profile, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
