import * as Location from 'expo-location';
import { supabase } from '@/src/lib/supabase';

export type NearbyProduct = {
  product_id: string; vendor_product_id: string; vendor_id: string; product_name: string;
  vendor_name: string; price: number; available_stock: number; in_stock: boolean;
  distance_meters: number; estimated_delivery_minutes: number; category_slug: string | null;
};
export type Category = { id: string; name: string; slug: string; parent_id: string | null };
export type Coordinates = { latitude: number; longitude: number };

export async function requestLocation(): Promise<Coordinates> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Location permission is required to find nearby hardware shops. You can enable it in your phone settings.');
  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { latitude: location.coords.latitude, longitude: location.coords.longitude };
}

export async function getCategories() {
  const { data, error } = await supabase.from('categories').select('id,name,slug,parent_id').eq('is_active', true).order('sort_order').limit(60);
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function searchNearbyProducts(query: string, point: Coordinates) {
  const { data, error } = await supabase.rpc('search_nearby_products', {
    p_query: query.trim() || null, p_latitude: point.latitude, p_longitude: point.longitude,
    p_radius_meters: 10000, p_limit: 40,
  });
  if (error) throw error;
  return (data ?? []) as NearbyProduct[];
}

export function money(value: number | string) {
  return `Rs. ${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

export function getFriendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  if (message.includes('fetch')) return 'Could not connect to the marketplace. Check your internet connection and Supabase settings.';
  return message;
}
