import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type CartItem = {
  vendorProductId: string;
  productId: string;
  vendorId: string;
  vendorName: string;
  productName: string;
  unit: string;
  price: number;
  availableStock: number;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  ready: boolean;
  subtotal: number;
  count: number;
  add: (item: Omit<CartItem, 'quantity'>) => string | null;
  quantity: (id: string, value: number) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const STORAGE_KEY = 'hardware-online-pasal-mobile-cart-v1';
const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (!mounted) return;
      if (value) {
        try {
          const parsed: unknown = JSON.parse(value);
          if (Array.isArray(parsed)) setItems(parsed.filter(isCartItem));
        } catch { void AsyncStorage.removeItem(STORAGE_KEY); }
      }
      setReady(true);
    }).catch((error: unknown) => {
      console.warn('Could not restore the mobile cart:', error);
      if (mounted) setReady(true);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (ready) void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch((error: unknown) => console.warn('Could not persist the mobile cart:', error));
  }, [items, ready]);

  const value = useMemo<CartState>(() => ({
    items,
    ready,
    subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    add(item) {
      if (item.availableStock < 1) return 'This product is currently out of stock.';
      const shop = items[0];
      if (shop && shop.vendorId !== item.vendorId) return `Your cart has products from ${shop.vendorName}. Checkout one shop at a time.`;
      const existing = items.find((row) => row.vendorProductId === item.vendorProductId);
      if (existing && existing.quantity >= item.availableStock) return `Only ${item.availableStock} are available from this shop.`;
      if (!existing && items.length >= 50) return 'An order can contain up to 50 different products.';
      setItems((current) => {
        const found = current.find((row) => row.vendorProductId === item.vendorProductId);
        return found
          ? current.map((row) => row.vendorProductId === item.vendorProductId ? { ...row, quantity: Math.min(row.quantity + 1, item.availableStock), price: item.price, availableStock: item.availableStock } : row)
          : [...current, { ...item, quantity: 1 }];
      });
      return null;
    },
    quantity(id, next) {
      setItems((current) => current.flatMap((row) => {
        if (row.vendorProductId !== id) return [row];
        if (next < 1) return [];
        return [{ ...row, quantity: Math.min(next, row.availableStock, 999) }];
      }));
    },
    remove(id) { setItems((current) => current.filter((row) => row.vendorProductId !== id)); },
    clear() { setItems([]); },
  }), [items, ready]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CartItem>;
  return typeof item.vendorProductId === 'string' && typeof item.productId === 'string'
    && typeof item.vendorId === 'string' && typeof item.vendorName === 'string'
    && typeof item.productName === 'string' && typeof item.unit === 'string'
    && typeof item.price === 'number' && item.price > 0
    && typeof item.availableStock === 'number' && Number.isInteger(item.availableStock) && item.availableStock >= 0
    && typeof item.quantity === 'number' && Number.isInteger(item.quantity) && item.quantity > 0;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider');
  return value;
}
