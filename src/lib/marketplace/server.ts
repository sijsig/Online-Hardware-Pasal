/**
 * Server-side Marketplace Service
 * Uses Supabase server client (cookies/auth) for Next.js Server Components & API Routes
 * All RPC calls run with user's auth context
 */

import { cookies } from 'next/headers';
import { createClient as createServerClient } from '@/utils/supabase/server';
import type {
  // Inputs
  FindNearestVendorInput,
  FindNearestRiderInput,
  CalculateCommissionOutput,
  CalculateRiderIncentiveOutput,
  AutoAssignRiderInput,
  AutoAssignRiderOutput,
  VendorConfirmOrderInput,
  VendorReadyForPickupInput,
  RiderPickupOrderInput,
  RiderDeliverOrderInput,
  AdminVerifyPaymentInput,
  AdminProcessVendorPayoutInput,
  AdminProcessRiderPayoutInput,
  AdminDashboardMetrics,
  SearchNearbyProductsInput,
  // Outputs
  NearestVendor,
  NearestRider,
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
} from './types';

// ===== ERROR HANDLING =====
class MarketplaceError extends Error {
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

// ===== INTERNAL: Get server client =====
async function getServerClient() {
  const cookieStore = await cookies();
  return createServerClient(cookieStore);
}

// ===== VENDOR RPCs =====

/** Find nearest vendors with a product in stock */
export async function findNearestVendor(input: FindNearestVendorInput): Promise<NearestVendor[]> {
  const supabase = await getServerClient();
  const { data, error } = await supabase.rpc('find_nearest_vendor', input);
  if (error) handleRpcError(error, 'find_nearest_vendor');
  return (data ?? []) as NearestVendor[];
}

/** Find nearest available riders */
export async function findNearestRider(input: FindNearestRiderInput): Promise<NearestRider[]> {
  const supabase = await getServerClient();
  const { data, error } = await supabase.rpc('find_nearest_rider', input);
  if (error) handleRpcError(error, 'find_nearest_rider');
  return (data ?? []) as NearestRider[];
}

/** Calculate commission for an order */
export async function calculateCommission(orderId: string): Promise<CalculateCommissionOutput> {
  const supabase = await getServerClient();
  const { data, error } = await supabase.rpc('calculate_commission', { p_order_id: orderId });
  if (error) handleRpcError(error, 'calculate_commission');
  return (data ?? [])[0] as CalculateCommissionOutput;
}

/** Calculate rider incentive (2% of margin) for an order */
export async function calculateRiderIncentive(
  orderId: string,
  deliveryAssignmentId: string
): Promise<CalculateRiderIncentiveOutput> {
  const supabase = await getServerClient();
  const { data, error } = await supabase.rpc('calculate_rider_incentive', {
    p_order_id: orderId,
    p_delivery_assignment_id: deliveryAssignmentId,
  });
  if (error) handleRpcError(error, 'calculate_rider_incentive');
  return (data ?? [])[0] as CalculateRiderIncentiveOutput;
}

/** Auto-assign nearest rider to order */
export async function autoAssignRider(input: AutoAssignRiderInput): Promise<string> {
  const supabase = await getServerClient();
  const { data, error } = await supabase.rpc('auto_assign_rider', input);
  if (error) handleRpcError(error, 'auto_assign_rider');
  return data as string;
}

/** Vendor confirms order (reserves stock, creates commission) */
export async function vendorConfirmOrder(input: VendorConfirmOrderInput): Promise<void> {
  const supabase = await getServerClient();
  const { error } = await supabase.rpc('vendor_confirm_order', input);
  if (error) handleRpcError(error, 'vendor_confirm_order');
}

/** Vendor marks order ready for pickup */
export async function vendorReadyForPickup(input: VendorReadyForPickupInput): Promise<void> {
  const supabase = await getServerClient();
  const { error } = await supabase.rpc('vendor_ready_for_pickup', input);
  if (error) handleRpcError(error, 'vendor_ready_for_pickup');
}

// ===== RIDER RPCs =====

/** Rider picks up order */
export async function riderPickupOrder(input: RiderPickupOrderInput): Promise<void> {
  const supabase = await getServerClient();
  const { error } = await supabase.rpc('rider_pickup_order', input);
  if (error) handleRpcError(error, 'rider_pickup_order');
}

/** Rider delivers order (releases stock, creates incentive, records COD) */
export async function riderDeliverOrder(input: RiderDeliverOrderInput): Promise<void> {
  const supabase = await getServerClient();
  const { error } = await supabase.rpc('rider_deliver_order', input);
  if (error) handleRpcError(error, 'rider_deliver_order');
}

// ===== ADMIN RPCs =====

/** Admin verifies COD payment */
export async function adminVerifyPayment(input: AdminVerifyPaymentInput): Promise<void> {
  const supabase = await getServerClient();
  const { error } = await supabase.rpc('admin_verify_payment', input);
  if (error) handleRpcError(error, 'admin_verify_payment');
}

/** Admin processes vendor payout */
export async function adminProcessVendorPayout(input: AdminProcessVendorPayoutInput): Promise<void> {
  const supabase = await getServerClient();
  const { error } = await supabase.rpc('admin_process_vendor_payout', input);
  if (error) handleRpcError(error, 'admin_process_vendor_payout');
}

/** Admin processes rider incentive payout */
export async function adminProcessRiderPayout(input: AdminProcessRiderPayoutInput): Promise<void> {
  const supabase = await getServerClient();
  const { error } = await supabase.rpc('admin_process_rider_payout', input);
  if (error) handleRpcError(error, 'admin_process_rider_payout');
}

/** Get admin dashboard metrics */
export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const supabase = await getServerClient();
  const { data, error } = await supabase.rpc('admin_dashboard_metrics');
  if (error) handleRpcError(error, 'admin_dashboard_metrics');
  return (data ?? [])[0] as AdminDashboardMetrics;
}

// ===== CUSTOMER/SEARCH RPCs =====

/** Search nearby products with distance & delivery estimates */
export async function searchNearbyProducts(input: SearchNearbyProductsInput): Promise<NearbyProduct[]> {
  const supabase = await getServerClient();
  const { data, error } = await supabase.rpc('search_nearby_products', input);
  if (error) handleRpcError(error, 'search_nearby_products');
  return (data ?? []) as NearbyProduct[];
}

// ===== SERVER-ONLY: Direct table access with RLS =====

/** Get all riders (admin only) */
export async function getAllRiders(): Promise<Rider[]> {
  const supabase = await getServerClient();
  const { data, error } = await supabase.from('riders').select('*').order('created_at', { ascending: false });
  if (error) handleRpcError(error, 'get_all_riders');
  return (data ?? []) as Rider[];
}

/** Get all delivery assignments for an order */
export async function getDeliveryAssignments(orderId: string): Promise<DeliveryAssignment[]> {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('delivery_assignments')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) handleRpcError(error, 'get_delivery_assignments');
  return (data ?? []) as DeliveryAssignment[];
}

/** Get payments for an order */
export async function getPaymentsForOrder(orderId: string): Promise<Payment[]> {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) handleRpcError(error, 'get_payments_for_order');
  return (data ?? []) as Payment[];
}

/** Get commissions for a vendor */
export async function getCommissionsForVendor(vendorId: string): Promise<Commission[]> {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('commissions')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false });
  if (error) handleRpcError(error, 'get_commissions_for_vendor');
  return (data ?? []) as Commission[];
}

/** Get rider incentives for a rider */
export async function getRiderIncentives(riderId: string): Promise<RiderIncentive[]> {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('rider_incentives')
    .select('*')
    .eq('rider_id', riderId)
    .order('created_at', { ascending: false });
  if (error) handleRpcError(error, 'get_rider_incentives');
  return (data ?? []) as RiderIncentive[];
}

/** Get vendor notifications */
export async function getVendorNotifications(vendorId: string, limit = 50): Promise<VendorNotification[]> {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('vendor_notifications')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('sent_at', { ascending: false })
    .limit(limit);
  if (error) handleRpcError(error, 'get_vendor_notifications');
  return (data ?? []) as VendorNotification[];
}

/** Get vendor products with filters */
export async function getVendorProducts(
  vendorId: string,
  options?: { activeOnly?: boolean; approvalStatus?: string }
): Promise<VendorProduct[]> {
  const supabase = await getServerClient();
  let query = supabase.from('vendor_products').select('*').eq('vendor_id', vendorId);

  if (options?.activeOnly) query = query.eq('is_active', true);
  if (options?.approvalStatus) query = query.eq('approval_status', options.approvalStatus);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) handleRpcError(error, 'get_vendor_products');
  return (data ?? []) as VendorProduct[];
}

/** Get vendor product submissions */
export async function getVendorProductSubmissions(vendorId: string): Promise<VendorProductSubmission[]> {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('vendor_product_submissions')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false });
  if (error) handleRpcError(error, 'get_vendor_product_submissions');
  return (data ?? []) as VendorProductSubmission[];
}

/** Get audit logs (admin only) */
export async function getAuditLogs(
  options?: { resourceType?: string; resourceId?: string; actorId?: string; limit?: number }
): Promise<AuditLog[]> {
  const supabase = await getServerClient();
  let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false });

  if (options?.resourceType) query = query.eq('resource_type', options.resourceType);
  if (options?.resourceId) query = query.eq('resource_id', options.resourceId);
  if (options?.actorId) query = query.eq('actor_id', options.actorId);
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) handleRpcError(error, 'get_audit_logs');
  return (data ?? []) as AuditLog[];
}

/** Mark vendor notification as read */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const supabase = await getServerClient();
  const { error } = await supabase
    .from('vendor_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);
  if (error) handleRpcError(error, 'mark_notification_read');
}

/** Update rider location */
export async function updateRiderLocation(riderId: string, latitude: number, longitude: number): Promise<void> {
  const supabase = await getServerClient();
  const { error } = await supabase
    .from('riders')
    .update({
      current_latitude: latitude,
      current_longitude: longitude,
      last_location_update: new Date().toISOString(),
    })
    .eq('id', riderId);
  if (error) handleRpcError(error, 'update_rider_location');
}

/** Update rider status */
export async function updateRiderStatus(riderId: string, status: 'offline' | 'available' | 'busy' | 'suspended'): Promise<void> {
  const supabase = await getServerClient();
  const { error } = await supabase.from('riders').update({ status }).eq('id', riderId);
  if (error) handleRpcError(error, 'update_rider_status');
}

// Re-export types
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
} from './types';
