/**
 * Mobile App - Marketplace Types
 * Matches the Supabase schema exactly (same as web)
 */

// ===== BASE TYPES =====
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'disputed';

export type RiderStatus = 'offline' | 'available' | 'busy' | 'suspended';
export type RiderApplicationStatus = 'pending' | 'approved' | 'rejected';
export type ShopStatus = 'pending' | 'active' | 'suspended' | 'rejected';
export type DeliveryStatus = 'offered' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled' | 'rejected';
export type PaymentStatus = 'pending' | 'collected' | 'verified' | 'released' | 'disputed' | 'refunded';
export type CommissionStatus = 'earned' | 'paid_out' | 'disputed' | 'adjusted';
export type IncentiveStatus = 'earned' | 'paid_out' | 'disputed';
export type VendorProductApproval = 'pending' | 'approved' | 'rejected';
export type VehicleType = 'bike' | 'scooter' | 'bicycle' | 'van';
export type UserRole = 'customer' | 'vendor_owner' | 'vendor_staff' | 'rider' | 'admin';

// ===== RPC INPUT/OUTPUT TYPES =====

export interface FindNearestVendorInput {
  p_product_id: string;
  p_latitude: number;
  p_longitude: number;
  p_radius_km?: number;
}

export interface NearestVendor {
  vendor_id: string;
  vendor_name: string;
  distance_km: number;
  price: number;
  stock_quantity: number;
  estimated_delivery_minutes: number;
}

export interface FindNearestRiderInput {
  p_latitude: number;
  p_longitude: number;
  p_radius_km?: number;
}

export interface NearestRider {
  rider_id: string;
  rider_name: string;
  vehicle_type: VehicleType;
  distance_km: number;
  rating: number;
  total_deliveries: number;
}

export interface CalculateCommissionOutput {
  commission_amount: number;
  vendor_payout: number;
  commission_rate: number;
}

export interface CalculateRiderIncentiveOutput {
  margin_amount: number;
  incentive_amount: number;
  incentive_rate: number;
}

export interface AutoAssignRiderInput {
  p_order_id: string;
}

export interface VendorConfirmOrderInput {
  p_order_id: string;
  p_vendor_id: string;
}

export interface VendorReadyForPickupInput {
  p_order_id: string;
  p_vendor_id: string;
}

export interface RiderPickupOrderInput {
  p_order_id: string;
  p_rider_id: string;
}

export interface RiderDeliverOrderInput {
  p_order_id: string;
  p_rider_id: string;
  p_cod_collected?: boolean;
  p_cod_amount?: number;
  p_collection_notes?: string;
  p_proof_image_url?: string;
}

export interface AdminVerifyPaymentInput {
  p_payment_id: string;
  p_admin_id: string;
}

export interface AdminProcessVendorPayoutInput {
  p_commission_id: string;
  p_admin_id: string;
  p_payout_reference: string;
}

export interface AdminProcessRiderPayoutInput {
  p_incentive_id: string;
  p_admin_id: string;
  p_payout_reference: string;
}

export interface AdminDashboardMetrics {
  today_orders: number;
  today_order_value: number;
  today_commission: number;
  active_vendors: number;
  available_riders: number;
  pending_orders: number;
  active_deliveries: number;
  pending_shop_applications: number;
  pending_rider_applications: number;
}

export interface SearchNearbyProductsInput {
  p_query?: string;
  p_latitude: number;
  p_longitude: number;
  p_radius_meters?: number;
  p_limit?: number;
}

export interface NearbyProduct {
  product_id: string;
  vendor_product_id: string;
  vendor_id: string;
  product_name: string;
  vendor_name: string;
  price: number;
  available_stock: number;
  in_stock: boolean;
  distance_meters: number;
  estimated_delivery_minutes: number;
  category_slug: string | null;
}

// ===== TABLE ROW TYPES =====

export interface Rider {
  id: string;
  user_id: string;
  vehicle_type: VehicleType;
  vehicle_number: string | null;
  license_number: string | null;
  status: RiderStatus;
  current_latitude: number | null;
  current_longitude: number | null;
  last_location_update: string | null;
  rating: number;
  total_deliveries: number;
  total_earnings: number;
  is_verified: boolean;
  verification_documents: Record<string, unknown>;
  application_status: RiderApplicationStatus;
  created_at: string;
  updated_at: string;
}

export interface DeliveryAssignment {
  id: string;
  order_id: string;
  rider_id: string;
  vendor_id: string;
  status: DeliveryStatus;
  offered_at: string;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  rejection_reason: string | null;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  dropoff_latitude: number | null;
  dropoff_longitude: number | null;
  estimated_distance_km: number | null;
  actual_distance_km: number | null;
  incentive_amount: number;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  method: string;
  status: PaymentStatus;
  collected_by: string | null;
  collected_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  released_at: string | null;
  collection_notes: string | null;
  proof_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Commission {
  id: string;
  order_id: string;
  vendor_id: string;
  subtotal_snapshot: number;
  commission_rate: number;
  commission_amount: number;
  vendor_payout: number;
  status: CommissionStatus;
  payout_reference: string | null;
  paid_out_at: string | null;
  paid_out_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RiderIncentive {
  id: string;
  rider_id: string;
  delivery_assignment_id: string;
  order_id: string;
  margin_amount: number;
  incentive_rate: number;
  incentive_amount: number;
  status: IncentiveStatus;
  paid_out_at: string | null;
  paid_out_by: string | null;
  payout_reference: string | null;
  created_at: string;
}

export interface VendorNotification {
  id: string;
  vendor_id: string;
  order_id: string | null;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sent_at: string;
  read_at: string | null;
  push_token: string | null;
  push_sent: boolean;
  push_response: Record<string, unknown> | null;
}

export interface VendorProduct {
  id: string;
  vendor_id: string;
  product_id: string;
  vendor_sku: string | null;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  reserved_quantity: number;
  is_active: boolean;
  approval_status: VendorProductApproval;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorProductSubmission {
  id: string;
  vendor_id: string;
  product_id: string | null;
  category_id: string | null;
  product_name: string;
  brand: string | null;
  model: string | null;
  unit: string;
  price: number;
  stock_quantity: number;
  vendor_sku: string | null;
  status: VendorProductApproval;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ===== COMPOSITE TYPES FOR UI =====

export interface OrderWithDetails {
  id: string;
  buyer_id: string;
  shop_id: string;
  status: OrderStatus;
  subtotal: number;
  shipping_fee: number;
  total: number;
  currency: string;
  shipping_address: Record<string, unknown>;
  notes: string | null;
  vendor_confirmed_at: string | null;
  rider_assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  delivery_fee: number;
  platform_fee: number;
  cod_amount: number;
  created_at: string;
  updated_at: string;
  shop?: { id: string; name: string; latitude: number | null; longitude: number | null };
  rider?: { id: string; user_id: string; vehicle_type: VehicleType };
  assignment?: DeliveryAssignment;
  payment?: Payment;
  commission?: Commission;
}

export interface RiderWithProfile extends Rider {
  profile?: {
    id: string;
    full_name: string | null;
    phone: string | null;
    city: string | null;
    district: string | null;
  };
}
