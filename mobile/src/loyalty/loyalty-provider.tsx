import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/auth/auth-provider';

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type LoyaltyProfile = {
  user_id: string;
  points: number;
  tier: LoyaltyTier;
  total_spent: number;
  orders_count: number;
  next_tier_threshold: number;
  next_tier_name: LoyaltyTier | null;
  tier_benefits: string[];
};

type LoyaltyState = {
  profile: LoyaltyProfile | null;
  ready: boolean;
  refresh: () => Promise<void>;
};

const LoyaltyContext = createContext<LoyaltyState | null>(null);

const TIER_THRESHOLDS: Record<LoyaltyTier, { points: number; benefits: string[] }> = {
  bronze: { points: 0, benefits: ['Earn 1 point per Rs. 100 spent', 'Standard support'] },
  silver: { points: 5000, benefits: ['Earn 1.25 points per Rs. 100 spent', 'Priority support', 'Free delivery on orders > Rs. 2000'] },
  gold: { points: 15000, benefits: ['Earn 1.5 points per Rs. 100 spent', 'Priority support', 'Free delivery on all orders', 'Early access to sales'] },
  platinum: { points: 50000, benefits: ['Earn 2 points per Rs. 100 spent', '24/7 dedicated support', 'Free delivery + express options', 'Exclusive deals', 'Birthday bonus points'] },
};

const TIER_ORDER: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum'];

export function LoyaltyProvider({ children }: { children: ReactNode }) {
  const { session, ready: authReady } = useAuth();
  const [profile, setProfile] = useState<LoyaltyProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (session?.user.id && authReady) {
      fetchProfile();
    } else if (!session?.user.id) {
      setProfile(null);
      setReady(true);
    }
  }, [session, authReady]);

  async function fetchProfile() {
    if (!session?.user.id) return;
    try {
      const { data, error } = await supabase
        .from('loyalty_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        const tier = calculateTier(data.points);
        const nextTierIndex = TIER_ORDER.indexOf(tier) + 1;
        setProfile({
          user_id: data.user_id,
          points: data.points,
          tier,
          total_spent: data.total_spent,
          orders_count: data.orders_count,
          next_tier_threshold: nextTierIndex < TIER_ORDER.length ? TIER_THRESHOLDS[TIER_ORDER[nextTierIndex]].points : data.points,
          next_tier_name: nextTierIndex < TIER_ORDER.length ? TIER_ORDER[nextTierIndex] : null,
          tier_benefits: TIER_THRESHOLDS[tier].benefits,
        });
      } else {
        const { data: newProfile } = await supabase
          .from('loyalty_profiles')
          .insert({ user_id: session.user.id, points: 0, total_spent: 0, orders_count: 0 })
          .select()
          .single();
        if (newProfile) {
          setProfile({
            user_id: newProfile.user_id,
            points: 0,
            tier: 'bronze',
            total_spent: 0,
            orders_count: 0,
            next_tier_threshold: TIER_THRESHOLDS.silver.points,
            next_tier_name: 'silver',
            tier_benefits: TIER_THRESHOLDS.bronze.benefits,
          });
        }
      }
    } catch (e) {
      console.warn('Failed to fetch loyalty profile:', e);
    } finally {
      setReady(true);
    }
  }

  function calculateTier(points: number): LoyaltyTier {
    if (points >= TIER_THRESHOLDS.platinum.points) return 'platinum';
    if (points >= TIER_THRESHOLDS.gold.points) return 'gold';
    if (points >= TIER_THRESHOLDS.silver.points) return 'silver';
    return 'bronze';
  }

  async function refresh() {
    await fetchProfile();
  }

  const value = useMemo<LoyaltyState>(() => ({ profile, ready, refresh }), [profile, ready]);

  return <LoyaltyContext.Provider value={value}>{children}</LoyaltyContext.Provider>;
}

export function useLoyalty() {
  const value = useContext(LoyaltyContext);
  if (!value) throw new Error('useLoyalty must be used inside LoyaltyProvider');
  return value;
}
