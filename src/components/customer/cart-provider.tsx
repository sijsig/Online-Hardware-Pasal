"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

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

type CartContextValue = {
  items: CartItem[];
  ready: boolean;
  count: number;
  subtotal: number;
  vendorId: string | null;
  vendorName: string | null;
  addItem: (item: Omit<CartItem, "quantity">) => string | null;
  setQuantity: (vendorProductId: string, quantity: number) => void;
  updateItemDetails: (vendorProductId: string, price: number, availableStock: number) => void;
  removeItem: (vendorProductId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "hardware-online-pasal-cart-v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as unknown;
          if (Array.isArray(parsed)) setItems(parsed.filter(isCartItem));
        }
      } catch (error) {
        console.error("Could not restore the saved cart:", error);
        try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be blocked by the browser. */ }
      } finally {
        setReady(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (ready) {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
      catch (error) { console.error("Could not save the cart in this browser:", error); }
    }
  }, [items, ready]);

  const value = useMemo<CartContextValue>(() => {
    const first = items[0];
    return {
      items,
      ready,
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      vendorId: first?.vendorId ?? null,
      vendorName: first?.vendorName ?? null,
      addItem(item) {
        if (item.availableStock < 1) return "This item is currently out of stock.";
        if (first && first.vendorId !== item.vendorId) {
          return `Your cart has items from ${first.vendorName}. Checkout one shop at a time, or clear your cart to shop here.`;
        }
        const existingItem = items.find((entry) => entry.vendorProductId === item.vendorProductId);
        if (existingItem && existingItem.quantity >= item.availableStock) return `Only ${item.availableStock} are available from this shop.`;
        if (!existingItem && items.length >= 50) return "An order can contain up to 50 different products.";
        setItems((current) => {
          const existing = current.find((entry) => entry.vendorProductId === item.vendorProductId);
          if (existing) {
            return current.map((entry) => entry.vendorProductId === item.vendorProductId
              ? { ...entry, quantity: Math.min(entry.quantity + 1, item.availableStock), price: item.price, availableStock: item.availableStock }
              : entry);
          }
          return [...current, { ...item, quantity: 1 }];
        });
        return null;
      },
      setQuantity(vendorProductId, quantity) {
        setItems((current) => current.flatMap((item) => {
          if (item.vendorProductId !== vendorProductId) return [item];
          if (quantity < 1) return [];
          if (item.availableStock < 1) return [item];
          return [{ ...item, quantity: Math.min(quantity, item.availableStock, 999) }];
        }));
      },
      updateItemDetails(vendorProductId, price, availableStock) {
        setItems((current) => current.map((item) => item.vendorProductId === vendorProductId
          ? { ...item, price, availableStock }
          : item));
      },
      removeItem(vendorProductId) {
        setItems((current) => current.filter((item) => item.vendorProductId !== vendorProductId));
      },
      clearCart() { setItems([]); },
    };
  }, [items, ready]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Partial<CartItem>;
  return typeof item.vendorProductId === "string"
    && typeof item.productId === "string"
    && typeof item.vendorId === "string"
    && typeof item.vendorName === "string"
    && typeof item.productName === "string"
    && typeof item.unit === "string"
    && typeof item.price === "number" && Number.isFinite(item.price) && item.price > 0
    && typeof item.availableStock === "number" && Number.isInteger(item.availableStock) && item.availableStock >= 0
    && typeof item.quantity === "number" && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 999;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
