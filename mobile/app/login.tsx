import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { AppButton, Field, Notice, PageHeader, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/auth/auth-provider';
import { supabase } from '@/src/lib/supabase';
import { getFriendlyError } from '@/src/marketplace';

export default function LoginScreen() {
  const { session } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => { if (session) router.back(); }, [session]);
  async function submit() {
    setBusy(true); setError(''); setSuccess('');
    try {
      if (mode === 'signup') {
        const redirectTo = Platform.OS === 'web' ? window.location.origin : Linking.createURL('auth/callback');
        const { error: authError } = await supabase.auth.signUp({ 
          email: email.trim(), 
          password,
          options: { emailRedirectTo: redirectTo, data: { full_name: name.trim() } } 
        });
        if (authError) throw authError;
        setSuccess('Account created! Check your email to confirm.');
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ 
          email: email.trim(), 
          password 
        });
        if (authError) throw authError;
      }
    } catch (e) { setError(getFriendlyError(e)); }
    finally { setBusy(false); }
  }
  return <Screen><PageHeader eyebrow="Your local hardware marketplace" title={mode === 'signin' ? 'Welcome back' : 'Create your account'} subtitle="Use the same passwordless email login as the Hardware Online Pasal website." />
    {mode === 'signup' ? <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Your name" /> : null}
    <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
    <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Your password" />
    {error ? <Notice tone="error">{error}</Notice> : null}{success ? <Notice tone="success">{success}</Notice> : null}
    <AppButton title={mode === 'signin' ? 'Sign in' : 'Create account'} loading={busy} onPress={() => void submit()} />
    <AppButton title={mode === 'signin' ? 'New here? Create an account' : 'Already registered? Sign in'} variant="quiet" onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setSuccess(''); }} />
  </Screen>;
}
