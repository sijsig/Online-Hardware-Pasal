import { useState, useEffect } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { AppButton, Card, Field, Notice, PageHeader, Screen } from '@/src/components/ui';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/auth/auth-provider';
import { colors } from '@/src/theme';

interface ReviewModalProps {
  productId: string;
  productName: string;
  shopId: string;
  orderId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReviewModal({ productId, productName, shopId, orderId, onClose, onSuccess }: ReviewModalProps) {
  const { profile, session } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!rating) { setError('Please select a rating'); return; }
    if (!session?.user.id || !profile) { setError('Please log in to review'); return; }

    setLoading(true); setError('');
    try {
      const { error } = await supabase.from('reviews').upsert({
        product_id: productId,
        buyer_id: session.user.id,
        shop_id: shopId,
        rating,
        comment: comment.trim() || null,
      }, { onConflict: 'product_id,buyer_id' });
      if (error) throw error;
      onSuccess();
      onClose();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return <Screen style={{ paddingTop: 0 }}>
    <PageHeader eyebrow="Rate your purchase" title={productName} subtitle="Your review helps other shoppers" />
    {error ? <Notice tone="error">{error}</Notice> : null}
    
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, gap: 16 }}>
      <ScrollView contentContainerStyle={{ gap: 16 }}>
        <Card style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 14, color: colors.muted }}>Your rating</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => setRating(star)}>
                <Text style={{ fontSize: 36, color: star <= rating ? colors.green : colors.line }}>
                  {star <= rating ? '★' : '☆'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {rating === 0 ? 'Tap a star' : rating === 1 ? 'Poor' : rating === 2 ? 'Fair' : rating === 3 ? 'Good' : rating === 4 ? 'Very good' : 'Excellent'}
          </Text>
        </Card>

        <Field label="Your experience (optional)" value={comment} onChangeText={setComment}
          multiline numberOfLines={5} placeholder="What did you like or dislike? Quality, delivery, price..." />
      </ScrollView>

      <AppButton title={loading ? 'Submitting...' : 'Submit review'} loading={loading} onPress={submit} />
      <AppButton title="Cancel" variant="quiet" onPress={onClose} />
    </KeyboardAvoidingView>
  </Screen>;
}

export function ReviewList({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [avgRating, setAvgRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);

  useEffect(() => {
    let alive = true;
    supabase.from('reviews')
      .select('rating, comment, created_at, profiles(full_name)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) console.warn(error);
        else {
          setReviews(data ?? []);
          const ratings = (data ?? []).map((r: any) => r.rating);
          setAvgRating(ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0);
          setTotalReviews(ratings.length);
        }
        setLoading(false);
      });
    return () => { alive = false; };
  }, [productId]);

  if (loading) return <Text style={{ color: colors.muted }}>Loading reviews...</Text>;
  if (totalReviews === 0) return <Text style={{ color: colors.muted, textAlign: 'center', padding: 16 }}>No reviews yet. Be the first!</Text>;

  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={{ fontSize: 36, fontWeight: '900', color: colors.green }}>{avgRating.toFixed(1)}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Text key={star} style={{ fontSize: 16, color: star <= Math.round(avgRating) ? colors.green : colors.line }}>
              {star <= Math.round(avgRating) ? '★' : '☆'}
            </Text>
          ))}
        </View>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{totalReviews} review{totalReviews !== 1 ? 's' : ''}</Text>
      </View>
    </View>
    {reviews.map((r: any) => (
      <Card key={r.created_at} style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontWeight: '800' }}>{r.profiles?.full_name ?? 'Anonymous'}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{new Date(r.created_at).toLocaleDateString()}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 2 }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Text key={star} style={{ fontSize: 14, color: star <= r.rating ? colors.green : colors.line }}>
              {star <= r.rating ? '★' : '☆'}
            </Text>
          ))}
        </View>
        {r.comment && <Text style={{ color: colors.ink }}>{r.comment}</Text>}
      </Card>
    ))}
  </View>;
}
