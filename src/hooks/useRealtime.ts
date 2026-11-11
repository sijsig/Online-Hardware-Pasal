"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

interface RealtimeOptions<T extends Record<string, any> = Record<string, any>> {
  /** Table to listen to */
  table: string;
  /** Filter for the subscription */
  filter?: string;
  /** Event types to listen to */
  events?: ("INSERT" | "UPDATE" | "DELETE")[];
  /** Callback when data changes */
  onChange?: (payload: RealtimePostgresChangesPayload<T>) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Whether to enable the subscription */
  enabled?: boolean;
}

/**
 * Hook for subscribing to Supabase Realtime changes
 */
export function useRealtime<T extends Record<string, any> = Record<string, any>>(options: RealtimeOptions<T>) {
  const {
    table,
    filter,
    events = ["INSERT", "UPDATE", "DELETE"],
    onChange,
    onError,
    enabled = true,
  } = options;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimePostgresChangesPayload<T> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    
    // Create channel
    const channel = supabase
      .channel(`realtime:${table}:${filter || "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter,
        },
        (payload: RealtimePostgresChangesPayload<T>) => {
          // Filter by event type
          if (!events.includes(payload.eventType)) return;
          
          setLastEvent(payload);
          onChange?.(payload);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
        if (status === "CHANNEL_ERROR") {
          onError?.(new Error("Realtime connection error"));
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [table, filter, events.join(","), enabled, onChange, onError]);

  // Manual unsubscribe
  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      createClient().removeChannel(channelRef.current);
      channelRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Resubscribe
  const resubscribe = useCallback(() => {
    unsubscribe();
    // The useEffect will re-run and create a new channel
  }, [unsubscribe]);

  return {
    isConnected,
    lastEvent,
    unsubscribe,
    resubscribe,
  };
}

/**
 * Hook for real-time order updates
 */
export function useRealtimeOrders() {
  const [newOrders, setNewOrders] = useState<any[]>([]);
  const [updatedOrders, setUpdatedOrders] = useState<any[]>([]);
  const [deletedOrderIds, setDeletedOrderIds] = useState<string[]>([]);

  useRealtime({
    table: "orders",
    events: ["INSERT", "UPDATE", "DELETE"],
    onChange: (payload) => {
      switch (payload.eventType) {
        case "INSERT":
          setNewOrders((prev) => [payload.new as any, ...prev].slice(0, 50));
          break;
        case "UPDATE":
          setUpdatedOrders((prev) => [payload.new as any, ...prev].slice(0, 50));
          break;
        case "DELETE":
          setDeletedOrderIds((prev) => [payload.old.id as string, ...prev].slice(0, 50));
          break;
      }
    },
  });

  const clearNewOrders = useCallback(() => setNewOrders([]), []);
  const clearUpdatedOrders = useCallback(() => setUpdatedOrders([]), []);
  const clearDeletedOrders = useCallback(() => setDeletedOrderIds([]), []);

  return {
    newOrders,
    updatedOrders,
    deletedOrderIds,
    clearNewOrders,
    clearUpdatedOrders,
    clearDeletedOrders,
    hasUpdates: newOrders.length > 0 || updatedOrders.length > 0 || deletedOrderIds.length > 0,
  };
}

/**
 * Hook for real-time shop updates
 */
export function useRealtimeShops() {
  const [newShops, setNewShops] = useState<any[]>([]);
  const [updatedShops, setUpdatedShops] = useState<any[]>([]);

  useRealtime({
    table: "vendors",
    events: ["INSERT", "UPDATE"],
    onChange: (payload) => {
      if (payload.eventType === "INSERT") {
        setNewShops((prev) => [payload.new as any, ...prev].slice(0, 20));
      } else if (payload.eventType === "UPDATE") {
        setUpdatedShops((prev) => [payload.new as any, ...prev].slice(0, 20));
      }
    },
  });

  return {
    newShops,
    updatedShops,
    clearNewShops: () => setNewShops([]),
    clearUpdatedShops: () => setUpdatedShops([]),
    hasUpdates: newShops.length > 0 || updatedShops.length > 0,
  };
}

/**
 * Hook for real-time rider updates
 */
export function useRealtimeRiders() {
  const [newRiders, setNewRiders] = useState<any[]>([]);
  const [updatedRiders, setUpdatedRiders] = useState<any[]>([]);

  useRealtime({
    table: "riders",
    events: ["INSERT", "UPDATE"],
    onChange: (payload) => {
      if (payload.eventType === "INSERT") {
        setNewRiders((prev) => [payload.new as any, ...prev].slice(0, 20));
      } else if (payload.eventType === "UPDATE") {
        setUpdatedRiders((prev) => [payload.new as any, ...prev].slice(0, 20));
      }
    },
  });

  return {
    newRiders,
    updatedRiders,
    clearNewRiders: () => setNewRiders([]),
    clearUpdatedRiders: () => setUpdatedRiders([]),
    hasUpdates: newRiders.length > 0 || updatedRiders.length > 0,
  };
}

/**
 * Hook for real-time product updates
 */
export function useRealtimeProducts() {
  const [newProducts, setNewProducts] = useState<any[]>([]);
  const [updatedProducts, setUpdatedProducts] = useState<any[]>([]);

  useRealtime({
    table: "products",
    events: ["INSERT", "UPDATE"],
    onChange: (payload) => {
      if (payload.eventType === "INSERT") {
        setNewProducts((prev) => [payload.new as any, ...prev].slice(0, 20));
      } else if (payload.eventType === "UPDATE") {
        setUpdatedProducts((prev) => [payload.new as any, ...prev].slice(0, 20));
      }
    },
  });

  return {
    newProducts,
    updatedProducts,
    clearNewProducts: () => setNewProducts([]),
    clearUpdatedProducts: () => setUpdatedProducts([]),
    hasUpdates: newProducts.length > 0 || updatedProducts.length > 0,
  };
}

/**
 * Hook for real-time delivery assignments
 */
export function useRealtimeDeliveries() {
  const [newDeliveries, setNewDeliveries] = useState<any[]>([]);
  const [updatedDeliveries, setUpdatedDeliveries] = useState<any[]>([]);

  useRealtime({
    table: "delivery_assignments",
    events: ["INSERT", "UPDATE"],
    onChange: (payload) => {
      if (payload.eventType === "INSERT") {
        setNewDeliveries((prev) => [payload.new as any, ...prev].slice(0, 20));
      } else if (payload.eventType === "UPDATE") {
        setUpdatedDeliveries((prev) => [payload.new as any, ...prev].slice(0, 20));
      }
    },
  });

  return {
    newDeliveries,
    updatedDeliveries,
    clearNewDeliveries: () => setNewDeliveries([]),
    clearUpdatedDeliveries: () => setUpdatedDeliveries([]),
    hasUpdates: newDeliveries.length > 0 || updatedDeliveries.length > 0,
  };
}

/**
 * Combined hook for all realtime updates (for dashboard)
 */
export function useRealtimeDashboard() {
  const orders = useRealtimeOrders();
  const shops = useRealtimeShops();
  const riders = useRealtimeRiders();
  const products = useRealtimeProducts();
  const deliveries = useRealtimeDeliveries();

  return {
    orders,
    shops,
    riders,
    products,
    deliveries,
    hasAnyUpdates: 
      orders.hasUpdates || 
      shops.hasUpdates || 
      riders.hasUpdates || 
      products.hasUpdates || 
      deliveries.hasUpdates,
    clearAll: () => {
      orders.clearNewOrders();
      orders.clearUpdatedOrders();
      orders.clearDeletedOrders();
      shops.clearNewShops();
      shops.clearUpdatedShops();
      riders.clearNewRiders();
      riders.clearUpdatedRiders();
      products.clearNewProducts();
      products.clearUpdatedProducts();
      deliveries.clearNewDeliveries();
      deliveries.clearUpdatedDeliveries();
    },
  };
}
