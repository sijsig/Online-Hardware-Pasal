/**
 * Mobile App - React Hooks for Marketplace Service
 * For use in Expo / React Native components
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  // Client service functions
  findNearestVendor,
  findNearestRider,
  calculateCommission,
  calculateRiderIncentive,
  autoAssignRider,
  vendorConfirmOrder,
  vendorReadyForPickup,
  riderPickupOrder,
  riderDeliverOrder,
  adminVerifyPayment,
  adminProcessVendorPayout,
  adminProcessRiderPayout,
  getAdminDashboardMetrics,
  searchNearbyProducts,
  subscribeToVendorOrders,
  subscribeToRiderAssignments,
  subscribeToVendorNotifications,
  // Types
  NearestVendor,
  NearestRider,
  NearbyProduct,
  AdminDashboardMetrics,
  DeliveryAssignment,
  VendorNotification,
  MarketplaceError,
  canTransition,
  ORDER_STATUS_FLOW,
} from './client';

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
        ? findNearestVendor({ p_product_id: productId, p_latitude: latitude, p_longitude: longitude, p_radius_km: radiusKm })
        : Promise.resolve([]),
    [productId, latitude, longitude, radiusKm]
  );
}

/** Find nearest available riders */
export function useNearestRiders(latitude: number | null, longitude: number | null, radiusKm = 10) {
  return useAsync(
    () =>
      latitude && longitude
        ? findNearestRider({ p_latitude: latitude, p_longitude: longitude, p_radius_km: radiusKm })
        : Promise.resolve([]),
    [latitude, longitude, radiusKm]
  );
}

/** Calculate commission for an order */
export function useCommission(orderId: string | null) {
  return useAsync(
    () => (orderId ? calculateCommission(orderId) : Promise.resolve(null)),
    [orderId]
  );
}

/** Calculate rider incentive (2% of margin) */
export function useRiderIncentive(orderId: string | null, deliveryAssignmentId: string | null) {
  return useAsync(
    () =>
      orderId && deliveryAssignmentId
        ? calculateRiderIncentive(orderId, deliveryAssignmentId)
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
      const assignmentId = await autoAssignRider({ p_order_id: orderId });
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
      await vendorConfirmOrder({ p_order_id: orderId, p_vendor_id: vendorId });
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
      await vendorReadyForPickup({ p_order_id: orderId, p_vendor_id: vendorId });
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
      await riderPickupOrder({ p_order_id: orderId, p_rider_id: riderId });
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
        await riderDeliverOrder({
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
    },
    []
  );

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
      await adminVerifyPayment({ p_payment_id: paymentId, p_admin_id: adminId });
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
      await adminProcessVendorPayout({ p_commission_id: commissionId, p_admin_id: adminId, p_payout_reference: payoutReference });
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
      await adminProcessRiderPayout({ p_incentive_id: incentiveId, p_admin_id: adminId, p_payout_reference: payoutReference });
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
  return useAsync(() => getAdminDashboardMetrics(), []);
}

// ===== CUSTOMER/SEARCH HOOKS =====

/** Search nearby products */
export function useNearbyProducts(
  query: string | null,
  latitude: number | null,
  longitude: number | null,
  radiusMeters = 10000,
  limit = 40
) {
  return useAsync(
    () =>
      latitude && longitude
        ? searchNearbyProducts({
            p_query: query || null,
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

/** Subscribe to vendor orders */
export function useVendorOrdersRealtime(vendorId: string | null, onNewOrder: (order: { id: string; shop_id: string }) => void) {
  useEffect(() => {
    if (!vendorId) return;
    const subscription = subscribeToVendorOrders(vendorId, onNewOrder);
    return () => subscription.unsubscribe();
  }, [vendorId, onNewOrder]);
}

/** Subscribe to rider assignments */
export function useRiderAssignmentsRealtime(riderId: string | null, onUpdate: (assignment: DeliveryAssignment) => void) {
  useEffect(() => {
    if (!riderId) return;
    const subscription = subscribeToRiderAssignments(riderId, onUpdate);
    return () => subscription.unsubscribe();
  }, [riderId, onUpdate]);
}

/** Subscribe to vendor notifications */
export function useVendorNotificationsRealtime(vendorId: string | null, onNotification: (notification: VendorNotification) => void) {
  useEffect(() => {
    if (!vendorId) return;
    const subscription = subscribeToVendorNotifications(vendorId, onNotification);
    return () => subscription.unsubscribe();
  }, [vendorId, onNotification]);
}

// ===== ORDER STATUS HOOKS =====

/** Get valid next statuses for an order */
export function useOrderStatusTransitions(currentStatus: string) {
  return ORDER_STATUS_FLOW[currentStatus] ?? [];
}

/** Check if status transition is valid */
export function useCanTransition(from: string, to: string): boolean {
  return canTransition(from, to);
}

// Re-export types and utilities
export type { MarketplaceError } from './client';
export { ORDER_STATUS_FLOW, canTransition } from './client';
