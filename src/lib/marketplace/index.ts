/**
 * Marketplace Service - Main Entry Point
 * 
 * Usage:
 * 
 * // Client Components (Next.js) / Expo - RPC functions
 * import { 
 *   findNearestVendor, 
 *   vendorConfirmOrder, 
 *   getAdminDashboardMetrics 
 * } from '@/lib/marketplace';
 * 
 * // Client Components (Next.js) / Expo - React hooks
 * import { 
 *   useNearestVendors, 
 *   useNearbyProducts, 
 *   useVendorConfirmOrder,
 *   useRiderDeliverOrder,
 *   useAdminDashboardMetrics 
 * } from '@/lib/marketplace/hooks';
 * 
 * // Server Components / API Routes
 * import { 
 *   findNearestVendor, 
 *   vendorConfirmOrder, 
 *   getAdminDashboardMetrics 
 * } from '@/lib/marketplace/server';
 * 
 * // Types
 * import type { NearestVendor, NearbyProduct, OrderStatus } from '@/lib/marketplace';
 */

// Client-side service (for Client Components & Expo)
export * from './client';

// Types
export * from './types';

// Note: Server functions are NOT re-exported here to avoid duplicate exports with client.
// Import server functions directly from '@/lib/marketplace/server'
// Note: Hooks are NOT re-exported here to avoid module conflicts.
// Import hooks directly from '@/lib/marketplace/hooks'
