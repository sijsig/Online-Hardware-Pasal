/**
 * React Hooks for Marketplace Service
 * Client-side hooks using the client service
 * For use in Next.js Client Components and Expo
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  // Client service functions (internal use only)
  findNearestVendor as findNearestVendorClient,
  findNearestRider as findNearestRiderClient,
  calculateCommission as calculateCommissionClient,
  calculateRiderIncentive as calculateRiderIncentiveClient,
  autoAssignRider as autoAssignRiderClient,
  vendorConfirmOrder as vendorConfirmOrderClient,
  vendorReadyForPickup as vendorReadyForPickupClient,
  riderPickupOrder as riderPickupOrderClient,
  riderDeliverOrder as riderDeliverOrderClient,
  adminVerifyPayment as adminVerifyPaymentClient,
  adminProcessVendorPayout as adminProcessVendorPayoutClient,
  adminProcessRiderPayout as adminProcessRiderPayoutClient,
  getAdminDashboardMetrics as getAdminDashboardMetricsClient,
  searchNearbyProducts as searchNearbyProductsClient,
  subscribeToVendorOrders,
  subscribeToRiderAssignments,
  subscribeToVendorNotifications,
  // Types from client (MarketplaceError is a class, needs value import)
  MarketplaceError,
} from './client';

// Types from types.ts
import type {
  NearestVendor,
  NearestRider,
  NearbyProduct,
  AdminDashboardMetrics,
  DeliveryAssignment,
  VendorNotification,
  OrderStatus,
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from './types';

// ===== GENERIC ASYNC HOOK =====

interface AsyncState<T> {
  data: T | null;
  error: MarketplaceError | null;
  loading: boolean;
}

function useAsync<T>(asyncFn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: true,
  });

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    async function execute() {
      setState({ data: null, error: null, loading: true });
      try {
        const result = await asyncFn();
        if (mountedRef.current && !cancelled) {
          setState({ data: result, error: null, loading: false });
        }
      } catch (error) {
        if (mountedRef.current && !cancelled) {
          setState({
            data: null,
            error: error instanceof MarketplaceError ? error : new MarketplaceError(String(error), 'UNKNOWN'),
            loading: false,
          });
        }
      }
    }

    execute();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, deps);

  const refresh = useCallback(() => {
    setState({ data: null, error: null, loading: true });
    asyncFn().then(
      (data) => mountedRef.current && setState({ data, error: null, loading: false }),
      (error) =>
        mountedRef.current &&
        setState({
          data: null,
          error: error instanceof MarketplaceError ? error : new MarketplaceError(String(error), 'UNKNOWN'),
          loading: false,
        })
    );
  }, [asyncFn]);

  return { ...state, refresh };
}

// ===== VENDOR HOOKS =====

/** Find nearest vendors with a product in stock */
export function useNearestVendors(
  productId: string | null,
  latitude: number | null,
  longitude: number | null,
  radiusKm = 20
) {
  return useAsync(
    () =>
      productId && latitude && longitude
        ? findNearestVendorClient({ p_product_id: productId, p_latitude: latitude, p_longitude: longitude, p_radius_km: radiusKm })
        : Promise.resolve([]),
    [productId, latitude, longitude, radiusKm]
  );
}

/** Find nearest available riders */
export function useNearestRiders(latitude: number | null, longitude: number | null, radiusKm = 10) {
  return useAsync(
    () =>
      latitude && longitude
        ? findNearestRiderClient({ p_latitude: latitude, p_longitude: longitude, p_radius_km: radiusKm })
        : Promise.resolve([]),
    [latitude, longitude, radiusKm]
  );
}

/** Calculate commission for an order */
export function useCommission(orderId: string | null) {
  return useAsync(
    () => (orderId ? calculateCommissionClient(orderId) : Promise.resolve(null)),
    [orderId]
  );
}

/** Calculate rider incentive (2% of margin) */
export function useRiderIncentive(orderId: string | null, deliveryAssignmentId: string | null) {
  return useAsync(
    () =>
      orderId && deliveryAssignmentId
        ? calculateRiderIncentiveClient(orderId, deliveryAssignmentId)
        : Promise.resolve(null),
    [orderId, deliveryAssignmentId]
  );
}

/** Auto-assign nearest rider */
export function useAutoAssignRider() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<MarketplaceError | null>(null);

  const assign = useCallback(async (orderId: string) => {
    setLoading(true);
    setError(null);
    try {
      const assignmentId = await autoAssignRiderClient({ p_order_id: orderId });
      return assignmentId;
    } catch (e) {
      const err = e instanceof MarketplaceError ? e : new MarketplaceError(String(e), 'UNKNOWN');
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { assign, loading, error };
}

/** Vendor confirms order */
export function useVendorConfirmOrder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<MarketplaceError | null>(null);

  const confirm = useCallback(async (orderId: string, vendorId: string) => {
    setLoading(true);
    setError(null);
    try {
      await vendorConfirmOrderClient({ p_order_id: orderId, p_vendor_id: vendorId });
    } catch (e) {
      const err = e instanceof MarketplaceError ? e : new MarketplaceError(String(e), 'UNKNOWN');
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { confirm, loading, error };
}

/** Vendor marks order ready for pickup */
export function useVendorReadyForPickup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<MarketplaceError | null>(null);

  const ready = useCallback(async (orderId: string, vendorId: string) => {
    setLoading(true);
    setError(null);
    try {
      await vendorReadyForPickupClient({ p_order_id: orderId, p_vendor_id: vendorId });
    } catch (e) {
      const err = e instanceof MarketplaceError ? e : new MarketplaceError(String(e), 'UNKNOWN');
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { ready, loading, error };
}

// ===== RIDER HOOKS =====

/** Rider picks up order */
export function useRiderPickupOrder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<MarketplaceError | null>(null);

  const pickup = useCallback(async (orderId: string, riderId: string) => {
    setLoading(true);
    setError(null);
    try {
      await riderPickupOrderClient({ p_order_id: orderId, p_rider_id: riderId });
    } catch (e) {
      const err = e instanceof MarketplaceError ? e : new MarketplaceError(String(e), 'UNKNOWN');
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { pickup, loading, error };
}

/** Rider delivers order */
export function useRiderDeliverOrder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<MarketplaceError | null>(null);

  const deliver = useCallback(
    async (input: {
      orderId: string;
      riderId: string;
      codCollected?: boolean;
      codAmount?: number;
      collectionNotes?: string;
      proofImageUrl?: string;
    }) => {
      setLoading(true);
      setError(null);
    try {
      await riderDeliverOrderClient({
        p_order_id: input.orderId,
        p_rider_id: input.riderId,
        p_cod_collected: input.codCollected,
        p_cod_amount: input.codAmount,
        p_collection_notes: input.collectionNotes,
        p_proof_image_url: input.proofImageUrl,
      });
    } catch (e) {
      const err = e instanceof MarketplaceError ? e : new MarketplaceError(String(e), 'UNKNOWN');
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deliver, loading, error };
}

// ===== ADMIN HOOKS =====

/** Admin verifies COD payment */
export function useAdminVerifyPayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<MarketplaceError | null>(null);

  const verify = useCallback(async (paymentId: string, adminId: string) => {
    setLoading(true);
    setError(null);
    try {
      await adminVerifyPaymentClient({ p_payment_id: paymentId, p_admin_id: adminId });
    } catch (e) {
      const err = e instanceof MarketplaceError ? e : new MarketplaceError(String(e), 'UNKNOWN');
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { verify, loading, error };
}

/** Admin processes vendor payout */
export function useAdminProcessVendorPayout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<MarketplaceError | null>(null);

  const process = useCallback(async (commissionId: string, adminId: string, payoutReference: string) => {
    setLoading(true);
    setError(null);
    try {
      await adminProcessVendorPayoutClient({ p_commission_id: commissionId, p_admin_id: adminId, p_payout_reference: payoutReference });
    } catch (e) {
      const err = e instanceof MarketplaceError ? e : new MarketplaceError(String(e), 'UNKNOWN');
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { process, loading, error };
}

/** Admin processes rider incentive payout */
export function useAdminProcessRiderPayout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<MarketplaceError | null>(null);

  const process = useCallback(async (incentiveId: string, adminId: string, payoutReference: string) => {
    setLoading(true);
    setError(null);
    try {
      await adminProcessRiderPayoutClient({ p_incentive_id: incentiveId, p_admin_id: adminId, p_payout_reference: payoutReference });
    } catch (e) {
      const err = e instanceof MarketplaceError ? e : new MarketplaceError(String(e), 'UNKNOWN');
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { process, loading, error };
}

/** Get admin dashboard metrics */
export function useAdminDashboardMetrics() {
  return useAsync(() => getAdminDashboardMetricsClient(), []);
}

// ===== CUSTOMER/SEARCH HOOKS =====

/** Search nearby products */
export function useNearbyProducts(
  query: string | undefined,
  latitude: number | null,
  longitude: number | null,
  radiusMeters = 10000,
  limit = 40
) {
  return useAsync(
    () =>
      latitude && longitude
        ? searchNearbyProductsClient({
            p_query: query,
            p_latitude: latitude,
            p_longitude: longitude,
            p_radius_meters: radiusMeters,
            p_limit: limit,
          })
        : Promise.resolve([]),
    [query, latitude, longitude, radiusMeters, limit]
  );
}

// ===== REALTIME HOOKS =====

/** Type guard for RealtimePostgresChangesPayload new record */
function isObjectWithId(value: unknown): value is Record<string, unknown> & { id: string } {
  return typeof value === 'object' && value !== null && 'id' in value;
}

/** Subscribe to vendor orders */
export function useVendorOrdersRealtime(
  vendorId: string | null | undefined,
  onNewOrder: (order: { id: string; shop_id: string }) => void
) {
  useEffect(() => {
    if (!vendorId) return;
    // Narrow vendorId to string after null check
    const vId = vendorId as string;
    let channel: RealtimeChannel | null = null;
    
    // Define callback with explicit type to avoid inference issues
    const handlePayload = (payload: RealtimePostgresChangesPayload<{ id: string; shop_id: string }>) => {
      if (isObjectWithId(payload.new) && 'shop_id' in payload.new) {
        onNewOrder(payload.new as unknown as { id: string; shop_id: string });
      }
    };
    
    (async () => {
      channel = await subscribeToVendorOrders(vId, handlePayload);
    })();
    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [vendorId, onNewOrder]);
}

/** Subscribe to rider assignments */
export function useRiderAssignmentsRealtime(
  riderId: string | null | undefined,
  onUpdate: (assignment: DeliveryAssignment) => void
) {
  useEffect(() => {
    if (!riderId) return;
    // Narrow riderId to string after null check
    const rId = riderId as string;
    let channel: RealtimeChannel | null = null;
    
    // Define callback with explicit type
    const handlePayload = (payload: RealtimePostgresChangesPayload<DeliveryAssignment>) => {
      if (isObjectWithId(payload.new)) {
        onUpdate(payload.new as unknown as DeliveryAssignment);
      }
    };
    
    (async () => {
      channel = await subscribeToRiderAssignments(rId, handlePayload);
    })();
    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [riderId, onUpdate]);
}

/** Subscribe to vendor notifications */
export function useVendorNotificationsRealtime(
  vendorId: string | null | undefined,
  onNotification: (notification: VendorNotification) => void
) {
  useEffect(() => {
    if (!vendorId) return;
    // Narrow vendorId to string after null check
    const vId = vendorId as string;
    let channel: RealtimeChannel | null = null;
    
    // Define callback with explicit type
    const handlePayload = (payload: RealtimePostgresChangesPayload<VendorNotification>) => {
      if (isObjectWithId(payload.new)) {
        onNotification(payload.new as unknown as VendorNotification);
      }
    };
    
    (async () => {
      channel = await subscribeToVendorNotifications(vId, handlePayload);
    })();
    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [vendorId, onNotification]);
}

// ===== ORDER STATUS HOOKS =====

// Import ORDER_STATUS_FLOW and canTransition from client
import { ORDER_STATUS_FLOW, canTransition } from './client';

/** Get valid next statuses for an order */
export function useOrderStatusTransitions(currentStatus: OrderStatus) {
  return ORDER_STATUS_FLOW[currentStatus] ?? [];
}

/** Check if status transition is valid */
export function useCanTransition(from: OrderStatus, to: OrderStatus): boolean {
  return canTransition(from, to);
}

// Re-export types only (NO RPC functions, NO ORDER_STATUS_FLOW, NO canTransition)
export type { OrderStatus, MarketplaceError } from './client';
