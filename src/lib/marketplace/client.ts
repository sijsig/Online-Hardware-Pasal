/**
 * Client-side Marketplace Service
 * Uses Supabase client to call RPC functions
 * Works in browser (Next.js client components) and Expo
 */

import { createClient } from '@/utils/supabase/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type {
  // Inputs
  FindNearestVendorInput,
  FindNearestRiderInput,
  AutoAssignRiderInput,
  VendorConfirmOrderInput,
  VendorReadyForPickupInput,
  RiderPickupOrderInput,
  RiderDeliverOrderInput,
  AdminVerifyPaymentInput,
  AdminProcessVendorPayoutInput,
  AdminProcessRiderPayoutInput,
  SearchNearbyProductsInput,
  // Outputs
  NearestVendor,
  NearestRider,
  CalculateCommissionOutput,
  CalculateRiderIncentiveOutput,
  AutoAssignRiderOutput,
  AdminDashboardMetrics,
  NearbyProduct,
  // Table types
  Rider,
  DeliveryAssignment,
  Payment,
  Commission,
  RiderIncentive,
  VendorNotification,
  VendorProduct,
  VendorProductSubmission,
  AuditLog,
  OrderStatus,
  OrderWithDetails,
} from './types';

// Singleton client
let clientInstance: ReturnType<typeof createClient> | null = null;
function getClient() {
  if (!clientInstance) clientInstance = createClient();
  return clientInstance;
}

// ===== ERROR HANDLING =====
export class MarketplaceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'MarketplaceError';
  }
}

function handleRpcError(error: unknown, operation: string): never {
  if (error instanceof MarketplaceError) throw error;
  const msg = error instanceof Error ? error.message : 'Unknown error';
  throw new MarketplaceError(`${operation} failed: ${msg}`, 'RPC_ERROR', error);
}

// ===== VENDOR RPCs =====

/** Find nearest vendors with a product in stock */
export async function findNearestVendor(input: FindNearestVendorInput): Promise<NearestVendor[]> {
  const supabase = getClient();
  const { data, error } = await supabase.rpc('find_nearest_vendor', input);
  if (error) handleRpcError(error, 'find_nearest_vendor');
  return (data ?? []) as NearestVendor[];
}

/** Find nearest available riders */
export async function findNearestRider(input: FindNearestRiderInput): Promise<NearestRider[]> {
  const supabase = getClient();
  const { data, error } = await supabase.rpc('find_nearest_rider', input);
  if (error) handleRpcError(error, 'find_nearest_rider');
  return (data ?? []) as NearestRider[];
}

/** Calculate commission for an order */
export async function calculateCommission(orderId: string): Promise<CalculateCommissionOutput> {
  const supabase = getClient();
  const { data, error } = await supabase.rpc('calculate_commission', { p_order_id: orderId });
  if (error) handleRpcError(error, 'calculate_commission');
  return (data ?? [])[0] as CalculateCommissionOutput;
}

/** Calculate rider incentive (2% of margin) for an order */
export async function calculateRiderIncentive(
  orderId: string,
  deliveryAssignmentId: string
): Promise<CalculateRiderIncentiveOutput> {
  const supabase = getClient();
  const { data, error } = await supabase.rpc('calculate_rider_incentive', {
    p_order_id: orderId,
    p_delivery_assignment_id: deliveryAssignmentId,
  });
  if (error) handleRpcError(error, 'calculate_rider_incentive');
  return (data ?? [])[0] as CalculateRiderIncentiveOutput;
}

/** Auto-assign nearest rider to order */
export async function autoAssignRider(input: AutoAssignRiderInput): Promise<string> {
  const supabase = getClient();
  const { data, error } = await supabase.rpc('auto_assign_rider', input);
  if (error) handleRpcError(error, 'auto_assign_rider');
  return data as string;
}

/** Vendor confirms order (reserves stock, creates commission) */
export async function vendorConfirmOrder(input: VendorConfirmOrderInput): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.rpc('vendor_confirm_order', input);
  if (error) handleRpcError(error, 'vendor_confirm_order');
}

/** Vendor marks order ready for pickup */
export async function vendorReadyForPickup(input: VendorReadyForPickupInput): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.rpc('vendor_ready_for_pickup', input);
  if (error) handleRpcError(error, 'vendor_ready_for_pickup');
}

// ===== RIDER RPCs =====

/** Rider picks up order */
export async function riderPickupOrder(input: RiderPickupOrderInput): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.rpc('rider_pickup_order', input);
  if (error) handleRpcError(error, 'rider_pickup_order');
}

/** Rider delivers order (releases stock, creates incentive, records COD) */
export async function riderDeliverOrder(input: RiderDeliverOrderInput): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.rpc('rider_deliver_order', input);
  if (error) handleRpcError(error, 'rider_deliver_order');
}

// ===== ADMIN RPCs =====

/** Admin verifies COD payment */
export async function adminVerifyPayment(input: AdminVerifyPaymentInput): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.rpc('admin_verify_payment', input);
  if (error) handleRpcError(error, 'admin_verify_payment');
}

/** Admin processes vendor payout */
export async function adminProcessVendorPayout(input: AdminProcessVendorPayoutInput): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.rpc('admin_process_vendor_payout', input);
  if (error) handleRpcError(error, 'admin_process_vendor_payout');
}

/** Admin processes rider incentive payout */
export async function adminProcessRiderPayout(input: AdminProcessRiderPayoutInput): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.rpc('admin_process_rider_payout', input);
  if (error) handleRpcError(error, 'admin_process_rider_payout');
}

/** Get admin dashboard metrics */
export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const supabase = getClient();
  const { data, error } = await supabase.rpc('admin_dashboard_metrics');
  if (error) handleRpcError(error, 'admin_dashboard_metrics');
  return (data ?? [])[0] as AdminDashboardMetrics;
}

// ===== CUSTOMER/SEARCH RPCs =====

/** Search nearby products with distance & delivery estimates */
export async function searchNearbyProducts(input: SearchNearbyProductsInput): Promise<NearbyProduct[]> {
  const supabase = getClient();
  const { data, error } = await supabase.rpc('search_nearby_products', input);
  if (error) handleRpcError(error, 'search_nearby_products');
  return (data ?? []) as NearbyProduct[];
}

// ===== REALTIME SUBSCRIPTIONS =====

/** Subscribe to new orders for a vendor */
export function subscribeToVendorOrders(
  vendorId: string,
  callback: (payload: RealtimePostgresChangesPayload<{ id: string; shop_id: string }>) => void
): RealtimeChannel {
  const supabase = getClient();
  return supabase
    .channel(`vendor_orders:${vendorId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'orders', filter: `shop_id=eq.${vendorId}` },
      callback
    )
    .subscribe();
}

/** Subscribe to delivery assignment updates for a rider */
export function subscribeToRiderAssignments(
  riderId: string,
  callback: (payload: RealtimePostgresChangesPayload<DeliveryAssignment>) => void
): RealtimeChannel {
  const supabase = getClient();
  return supabase
    .channel(`rider_assignments:${riderId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'delivery_assignments', filter: `rider_id=eq.${riderId}` },
      callback
    )
    .subscribe();
}

/** Subscribe to vendor notifications */
export function subscribeToVendorNotifications(
  vendorId: string,
  callback: (payload: RealtimePostgresChangesPayload<VendorNotification>) => void
): RealtimeChannel {
  const supabase = getClient();
  return supabase
    .channel(`vendor_notifications:${vendorId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'vendor_notifications', filter: `vendor_id=eq.${vendorId}` },
      callback
    )
    .subscribe();
}

// ===== HELPER: Order status transitions =====

export const ORDER_STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['picked_up', 'cancelled'],
  picked_up: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: ['returned', 'disputed'],
  cancelled: [],
  returned: [],
  disputed: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_FLOW[from]?.includes(to) ?? false;
}

// Re-export types for convenience
export type {
  OrderStatus,
  RiderStatus,
  DeliveryStatus,
  PaymentStatus,
  CommissionStatus,
  IncentiveStatus,
  VendorProductApproval,
  VehicleType,
  UserRole,
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from './types';
