import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Card, Notice, PageHeader, Screen, SectionTitle } from '@/src/components/ui';
import { useAuth } from '@/src/auth/auth-provider';
import { useLoyalty } from '@/src/loyalty/loyalty-provider';
import { colors } from '@/src/theme';

const TIER_ICONS: Record<string, string> = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎' };
const TIER_COLORS: Record<string, string> = { bronze: '#cd7f32', silver: '#c0c0c0', gold: '#ffd700', platinum: '#e5e4e2' };

export default function LoyaltyScreen() {
  const { session } = useAuth();
  const { profile, ready, refresh } = useLoyalty();
  const [error, setError] = useState('');

  useEffect(() => {
    if (session?.user.id && ready) {
      refresh();
    }
  }, [session, ready]);

  if (!session) return <Screen><PageHeader title="Loyalty" subtitle="Sign in to see your rewards." /><Notice>Please sign in to view your loyalty status and rewards.</Notice><Link href="/login" asChild><Card style={{ padding: 16, alignItems: 'center' }}><Text style={{ color: colors.green, fontWeight: '800' }}>Sign in</Text></Card></Link></Screen>;

  if (!ready) return <Screen><ActivityIndicator color={colors.green} /></Screen>;

  if (!profile) return <Screen><PageHeader title="Loyalty" subtitle="Loading your rewards…" /><ActivityIndicator color={colors.green} /></Screen>;

  const nextTierProgress = profile.next_tier_name 
    ? Math.min(100, ((profile.points - getTierThreshold(profile.tier)) / (profile.next_tier_threshold - getTierThreshold(profile.tier))) * 100)
    : 100;

  return <Screen>
    <PageHeader eyebrow="Your rewards" title="Loyalty Program" subtitle="Earn points on every purchase" />
    {error ? <Notice tone="error">{error}</Notice> : null}

    {/* Tier Card */}
    <Card style={{ padding: 20, alignItems: 'center', gap: 12 }}>
      <Text style={{ fontSize: 48 }}>{TIER_ICONS[profile.tier] ?? '🏆'}</Text>
      <Text style={{ fontSize: 24, fontWeight: '900', color: TIER_COLORS[profile.tier] || colors.ink, textTransform: 'uppercase' }}>
        {profile.tier} tier
      </Text>
      <Text style={{ fontSize: 14, color: colors.muted }}>{profile.points.toLocaleString()} points</Text>
    </Card>

    {/* Progress to next tier */}
    {profile.next_tier_name ? (
      <Card style={{ padding: 16, gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontWeight: '800', color: colors.ink }}>Next tier: {TIER_ICONS[profile.next_tier_name]} {profile.next_tier_name}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{profile.points.toLocaleString()} / {profile.next_tier_threshold.toLocaleString()} pts</Text>
        </View>
        <View style={{ height: 8, backgroundColor: colors.line, borderRadius: 4, overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${nextTierProgress}%`, backgroundColor: TIER_COLORS[profile.next_tier_name] || colors.green, borderRadius: 4 }} />
        </View>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {Math.round(profile.next_tier_threshold - profile.points).toLocaleString()} points to {profile.next_tier_name}
        </Text>
      </Card>
    ) : (
      <Card style={{ padding: 16, alignItems: 'center' }}>
        <Text style={{ fontSize: 32 }}>🎉</Text>
        <Text style={{ fontWeight: '800', color: colors.ink }}>Maximum tier reached!</Text>
        <Text style={{ color: colors.muted }}>You're a {profile.tier} member with all benefits unlocked.</Text>
      </Card>
    )}

    {/* Stats */}
    <SectionTitle title="Your stats" />
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <StatCard label="Total spent" value={`Rs. ${(profile.total_spent / 100).toLocaleString()}`} />
      <StatCard label="Orders" value={profile.orders_count.toString()} />
      <StatCard label="Points" value={profile.points.toLocaleString()} />
    </View>

    {/* Benefits */}
    <SectionTitle title="Your benefits" />
    <View style={{ gap: 8 }}>
      {profile.tier_benefits.map((benefit, i) => (
        <Card key={i} style={{ padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <Text style={{ fontSize: 18, marginTop: 2 }}>✓</Text>
          <Text style={{ color: colors.ink, flex: 1 }}>{benefit}</Text>
        </Card>
      ))}
    </View>

    {/* Tier comparison */}
    <SectionTitle title="All tiers" />
    <View style={{ gap: 8 }}>
      {['bronze', 'silver', 'gold', 'platinum'].map((tier) => (
        <Card key={tier} style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: tier === profile.tier ? colors.greenSoft : colors.white, borderColor: tier === profile.tier ? colors.green : colors.line, borderWidth: tier === profile.tier ? 2 : 1 }}>
          <Text style={{ fontSize: 24 }}>{TIER_ICONS[tier]}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', color: colors.ink, textTransform: 'capitalize' }}>{tier} {tier === profile.tier ? '· Current' : ''}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{getTierThreshold(tier).toLocaleString()}+ points</Text>
          </View>
          <Text style={{ fontSize: 10, color: colors.muted }}>{tier === 'platinum' ? 'Max' : `Next: ${['silver', 'gold', 'platinum'][['bronze', 'silver', 'gold'].indexOf(tier)] ?? '—'}`}</Text>
        </Card>
      ))}
    </View>

    <Link href="/(tabs)/search" asChild>
      <Card style={{ marginTop: 16, padding: 16, alignItems: 'center' }}>
        <Text style={{ color: colors.green, fontWeight: '800' }}>Start earning → Browse hardware</Text>
      </Card>
    </Link>
  </Screen>;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return <View style={{ flex: 1, padding: 16, backgroundColor: colors.greenSoft, borderRadius: 12, alignItems: 'center', gap: 4 }}>
    <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink }}>{value}</Text>
    <Text style={{ color: colors.muted, fontSize: 11 }}>{label}</Text>
  </View>;
}

function getTierThreshold(tier: string): number {
  const thresholds: Record<string, number> = { bronze: 0, silver: 5000, gold: 15000, platinum: 50000 };
  return thresholds[tier] ?? 0;
}
