import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/auth/auth-provider';

export type FavoriteItem = {
  productId: string;
  productName: string;
  vendorId: string;
  vendorName: string;
  price: number;
  imageUrl?: string;
  addedAt: string;
};

type FavoritesState = {
  items: FavoriteItem[];
  ready: boolean;
  isFavorite: (productId: string) => boolean;
  toggle: (item: Omit<FavoriteItem, 'addedAt'>) => Promise<string | null>;
  add: (item: Omit<FavoriteItem, 'addedAt'>) => Promise<string | null>;
  remove: (productId: string) => Promise<void>;
  clear: () => Promise<void>;
  sync: () => Promise<void>;
};

const STORAGE_KEY = 'hardware-online-pasal-mobile-favorites-v1';
const FavoritesContext = createContext<FavoritesState | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [ready, setReady] = useState(false);
  const { session, ready: authReady } = useAuth();

  // Load from AsyncStorage on mount
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (!mounted) return;
      if (value) {
        try {
          const parsed: unknown = JSON.parse(value);
          if (Array.isArray(parsed)) setItems(parsed.filter(isFavoriteItem));
        } catch { AsyncStorage.removeItem(STORAGE_KEY); }
      }
      setReady(true);
    }).catch(() => setReady(true));
    return () => { mounted = false; };
  }, []);

  // Persist to AsyncStorage
  useEffect(() => {
    if (ready) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  }, [items, ready]);

  // Sync with Supabase when auth changes
  useEffect(() => {
    if (session?.user.id && ready) {
      syncWithSupabase();
    }
  }, [session, ready]);

  async function syncWithSupabase() {
    if (!session?.user.id) return;
    
    try {
      const { data: remote, error } = await supabase
        .from('favorites')
        .select('product_id, created_at')
        .eq('user_id', session.user.id);
      
      if (error) throw error;

      const remoteItems = (remote ?? []).map((r: any) => ({
        productId: r.product_id,
        addedAt: r.created_at,
      }));

      setItems((local) => {
        const merged = new Map<string, FavoriteItem>();
        
        local.forEach((item) => merged.set(item.productId, item));
        
        for (const remoteItem of remoteItems) {
          if (!merged.has(remoteItem.productId)) {
            merged.set(remoteItem.productId, {
              productId: remoteItem.productId,
              productName: 'Loading...',
              vendorId: '',
              vendorName: '',
              price: 0,
              addedAt: remoteItem.addedAt,
            });
          }
        }
        
        return Array.from(merged.values());
      });
    } catch (e) {
      console.warn('Favorites sync failed:', e);
    }
  }

  async function pushToSupabase(productId: string, action: 'add' | 'remove') {
    if (!session?.user.id) return;
    
    try {
      if (action === 'add') {
        await supabase.from('favorites').upsert({
          user_id: session.user.id,
          product_id: productId,
        }, { onConflict: 'user_id,product_id' });
      } else {
        await supabase.from('favorites').delete().eq('user_id', session.user.id).eq('product_id', productId);
      }
    } catch (e) {
      console.warn('Failed to push favorite to Supabase:', e);
    }
  }

  function isFavorite(productId: string): boolean {
    return items.some((item) => item.productId === productId);
  }

  async function add(item: Omit<FavoriteItem, 'addedAt'>): Promise<string | null> {
    if (isFavorite(item.productId)) return 'Already in wishlist';
    
    const newItem: FavoriteItem = { ...item, addedAt: new Date().toISOString() };
    setItems((current) => [...current, newItem]);
    pushToSupabase(item.productId, 'add');
    return null;
  }

  async function remove(productId: string): Promise<void> {
    setItems((current) => current.filter((item) => item.productId !== productId));
    pushToSupabase(productId, 'remove');
  }

  async function toggle(item: Omit<FavoriteItem, 'addedAt'>): Promise<string | null> {
    if (isFavorite(item.productId)) {
      await remove(item.productId);
      return null;
    }
    return add(item);
  }

  async function clear(): Promise<void> {
    setItems([]);
    if (session?.user.id) {
      await supabase.from('favorites').delete().eq('user_id', session.user.id);
    }
  }

  async function sync(): Promise<void> {
    await syncWithSupabase();
  }

  const value = useMemo<FavoritesState>(() => ({
    items,
    ready,
    isFavorite,
    toggle,
    add,
    remove,
    clear,
    sync,
  }), [items, ready]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

function isFavoriteItem(value: unknown): value is FavoriteItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<FavoriteItem>;
  return typeof item.productId === 'string' && typeof item.productName === 'string'
    && typeof item.vendorId === 'string' && typeof item.vendorName === 'string'
    && typeof item.price === 'number' && item.price >= 0
    && typeof item.addedAt === 'string';
}

export function useFavorites() {
  const value = useContext(FavoritesContext);
  if (!value) throw new Error('useFavorites must be used inside FavoritesProvider');
  return value;
}
