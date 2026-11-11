/**
 * Mobile App - Marketplace Service Entry Point
 * 
 * Usage in Expo/React Native:
 * 
 * import { 
 *   useNearestVendors, 
 *   useNearbyProducts, 
 *   useVendorConfirmOrder,
 *   useRiderDeliverOrder,
 *   useAdminDashboardMetrics 
 * } from '@/lib/marketplace';
 * 
 * // Direct RPC calls (outside React)
 * import { 
 *   findNearestVendor, 
 *   vendorConfirmOrder, 
 *   riderDeliverOrder 
 * } from '@/lib/marketplace/client';
 */

// Client-side service & hooks (for Expo/React Native components)
export * from './client';
export * from './hooks';

// Types
export * from './types';
