import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/auth/auth-provider';

export type LowStockAlert = {
  id: string;
  product_id: string;
  product_name: string;
  current_stock: number;
  threshold: number;
  vendor_sku: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LowStockSettings = {
  enabled: boolean;
  threshold: number; // default threshold percentage or absolute value
  notify_via_push: boolean;
  notify_via_email: boolean;
};

interface VendorProductWithProduct {
  id: string;
  product_id: string;
  stock_quantity: number;
  vendor_sku: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  products: { name: string }[];
}

type LowStockContextType = {
  alerts: LowStockAlert[];
  settings: LowStockSettings;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateSettings: (settings: Partial<LowStockSettings>) => Promise<void>;
  dismissAlert: (alertId: string) => Promise<void>;
  checkAndCreateAlerts: () => Promise<void>;
};

const LowStockContext = createContext<LowStockContextType | null>(null);

export function LowStockProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth();
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [settings, setSettings] = useState<LowStockSettings>({
    enabled: true,
    threshold: 10,
    notify_via_push: true,
    notify_via_email: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = async () => {
    if (!session?.user.id) return;
    setLoading(true);
    setError(null);
    try {
      // Get vendor's shop
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', session.user.id)
        .maybeSingle();
      
      if (shopError) throw shopError;
      if (!shop) {
        setAlerts([]);
        setLoading(false);
        return;
      }

      // Get vendor products with low stock
      const { data, error: alertsError } = await supabase
        .from('vendor_products')
        .select(`
          id,
          product_id,
          stock_quantity,
          vendor_sku,
          is_active,
          created_at,
          updated_at,
          products!inner(name)
        `)
        .eq('vendor_id', shop.id)
        .eq('is_active', true)
        .eq('approval_status', 'approved')
        .lte('stock_quantity', settings.threshold);

      if (alertsError) throw alertsError;

      const typedData = (data ?? []) as unknown as VendorProductWithProduct[];

      const formattedAlerts: LowStockAlert[] = typedData.map((item) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.products[0]?.name ?? 'Unknown Product',
        current_stock: item.stock_quantity,
        threshold: settings.threshold,
        vendor_sku: item.vendor_sku,
        is_active: item.is_active,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));

      setAlerts(formattedAlerts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load low stock alerts');
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<LowStockSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    await loadAlerts();
  };

  const dismissAlert = async (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  const checkAndCreateAlerts = async () => {
    // This would typically be a background job or triggered on inventory updates
    await loadAlerts();
  };

  useEffect(() => {
    if (session?.user.id) {
      loadAlerts();
    }
  }, [session, settings.threshold]);

  const value = useMemo<LowStockContextType>(
    () => ({
      alerts,
      settings,
      loading,
      error,
      refresh: loadAlerts,
      updateSettings,
      dismissAlert,
      checkAndCreateAlerts,
    }),
    [alerts, settings, loading, error, loadAlerts, updateSettings, dismissAlert, checkAndCreateAlerts]
  );

  return <LowStockContext.Provider value={value}>{children}</LowStockContext.Provider>;
}

export function useLowStockAlerts() {
  const context = useContext(LowStockContext);
  if (!context) throw new Error('useLowStockAlerts must be used within LowStockProvider');
  return context;
}
