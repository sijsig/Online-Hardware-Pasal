/**
 * Shared Admin Types
 * Centralized type definitions for the admin panel
 */

// ============================================
// Core Entities
// ============================================

export interface Shop {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address_line: string;
  city: string;
  district: string | null;
  province: string | null;
  description: string | null;
  status: ShopStatus;
  owner_id: string | null;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  gst_number: string | null;
  pan_number: string | null;
  bank_account: string | null;
  bank_ifsc: string | null;
}

export type ShopStatus = "pending" | "active" | "suspended" | "rejected";

export interface ShopOwner {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
}

// ============================================
// Rider Types
// ============================================

export interface Rider {
  user_id: string;
  vehicle_type: string | null;
  license_number: string | null;
  status: RiderStatus;
  application_status: RiderApplicationStatus;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
}

export type RiderStatus = "offline" | "available" | "busy" | "suspended";
export type RiderApplicationStatus = "pending" | "approved" | "rejected";

export interface DeliveryAssignment {
  id: string;
  order_id: string;
  rider_id: string;
  status: DeliveryStatus;
  created_at: string;
  picked_up_at: string | null;
  delivered_at: string | null;
}

export type DeliveryStatus = "offered" | "accepted" | "picked_up" | "delivered" | "cancelled";

// ============================================
// Order Types
// ============================================

export interface Order {
  id: string;
  customer_id: string;
  vendor_id: string;
  total: number;
  subtotal: number;
  delivery_fee: number;
  commission_rate: number;
  commission_amount: number;
  status: OrderStatus;
  payment_method: string;
  payment_status: string;
  delivery_address_snapshot: DeliveryAddressSnapshot;
  created_at: string;
  confirmed_at: string | null;
  delivered_at: string | null;
}

export type OrderStatus = 
  | "pending" 
  | "confirmed" 
  | "preparing" 
  | "delivering" 
  | "delivered" 
  | "cancelled";

export interface DeliveryAddressSnapshot {
  address_line?: string;
  city?: string;
  phone?: string;
  full_name?: string;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_brand: string | null;
  product_model: string | null;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

// ============================================
// Product Types
// ============================================

export interface Category {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  is_active: boolean;
  sort_order: number;
}

export interface Product {
  id: string;
  category_id: string | null;
  vendor_id: string | null;
  name: string;
  slug: string;
  brand: string | null;
  model: string | null;
  unit: string;
  price: number;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
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
  status: SubmissionStatus;
  created_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

export type SubmissionStatus = "pending" | "approved" | "rejected";

// ============================================
// Payment Types
// ============================================

export interface Payment {
  order_id: string;
  method: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  cash_collected_at: string | null;
  created_at: string;
}

export type PaymentStatus = "collected" | "pending" | "failed" | "refunded";

export interface Commission {
  id: string;
  order_id: string;
  vendor_id: string;
  subtotal_snapshot: number;
  rate_snapshot: number;
  commission_amount: number;
  vendor_payout: number;
  status: CommissionStatus;
  payout_reference: string | null;
  created_at: string;
  paid_at: string | null;
}

export type CommissionStatus = "earned" | "paid" | "pending";

// ============================================
// Customer Types
// ============================================

export interface Customer {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  created_at: string;
}

// ============================================
// Dashboard & Metrics
// ============================================

export interface DashboardMetrics {
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

export interface QuickStat {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  href: string;
  icon: string;
}

// ============================================
// Admin User Types
// ============================================

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "super_admin";
  created_at: string;
}

// ============================================
// UI State Types
// ============================================

export interface TabConfig<T extends string = string> {
  value: T;
  label: string;
  count: number;
}

export interface StatusConfig {
  label: string;
  className: string;
  icon?: string;
  step?: number;
}

export interface SelectOption {
  value: string;
  label: string;
}

// ============================================
// Feature Flags
// ============================================

export interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

// ============================================
// Settings Types
// ============================================

export interface MarketplaceSettings {
  default_commission_rate: number;
  platform_name: string;
  support_email: string;
  support_phone: string;
}

export interface FeatureFlags {
  cod_enabled: boolean;
  online_payment_enabled: boolean;
  vendor_registration_enabled: boolean;
  rider_registration_enabled: boolean;
  reviews_enabled: boolean;
  wishlist_enabled: boolean;
}

// ============================================
// Utility Types
// ============================================

export type AdminRoute = 
  | "/admin"
  | "/admin/shops"
  | "/admin/riders"
  | "/admin/orders"
  | "/admin/products"
  | "/admin/payments"
  | "/admin/customers"
  | "/admin/settings";

export interface NavigationItem {
  href: AdminRoute;
  label: string;
  icon: string;
}

// ============================================
// Status Configurations (for consistent UI)
// ============================================

export const SHOP_STATUS_CONFIG: Record<ShopStatus, StatusConfig> = {
  pending: { label: "Pending Review", className: "bg-yellow-100 text-yellow-700", icon: "⏳" },
  active: { label: "Active", className: "bg-green-100 text-green-700", icon: "✅" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-700", icon: "⛔" },
  rejected: { label: "Rejected", className: "bg-gray-100 text-gray-700", icon: "❌" },
};

export const RIDER_STATUS_CONFIG: Record<RiderStatus, StatusConfig> = {
  offline: { label: "Offline", className: "bg-gray-100 text-gray-700" },
  available: { label: "Available", className: "bg-green-100 text-green-700" },
  busy: { label: "Busy", className: "bg-blue-100 text-blue-700" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-700" },
};

export const RIDER_APP_STATUS_CONFIG: Record<RiderApplicationStatus, StatusConfig> = {
  pending: { label: "Pending Review", className: "bg-yellow-100 text-yellow-700" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
};

export const ORDER_STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700", step: 1 },
  confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-700", step: 2 },
  preparing: { label: "Preparing", className: "bg-purple-100 text-purple-700", step: 3 },
  delivering: { label: "Delivering", className: "bg-orange-100 text-orange-700", step: 4 },
  delivered: { label: "Delivered", className: "bg-green-100 text-green-700", step: 5 },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700", step: 0 },
};

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, StatusConfig> = {
  collected: { label: "Collected", className: "bg-green-100 text-green-700" },
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700" },
  refunded: { label: "Refunded", className: "bg-gray-100 text-gray-700" },
};

export const COMMISSION_STATUS_CONFIG: Record<CommissionStatus, StatusConfig> = {
  earned: { label: "Earned", className: "bg-blue-100 text-blue-700" },
  paid: { label: "Paid", className: "bg-green-100 text-green-700" },
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700" },
};

export const SUBMISSION_STATUS_CONFIG: Record<SubmissionStatus, StatusConfig> = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
};

// ============================================
// Navigation Config
// ============================================

export const ADMIN_NAVIGATION: NavigationItem[] = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/shops", label: "Shops", icon: "🏪" },
  { href: "/admin/riders", label: "Riders", icon: "🛵" },
  { href: "/admin/orders", label: "Orders", icon: "📦" },
  { href: "/admin/products", label: "Products", icon: "🔧" },
  { href: "/admin/payments", label: "Payments", icon: "💰" },
  { href: "/admin/customers", label: "Customers", icon: "👥" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
];
