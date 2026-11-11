"use client";

import React from "react";
import { useRealtime, useRealtimeDashboard } from "@/hooks/useRealtime";

/**
 * Realtime connection indicator for the admin header
 */
export function RealtimeIndicator() {
  const { isConnected } = useRealtime({
    table: "orders",
    enabled: true,
  });

  return (
    <div className="flex items-center gap-2" title={isConnected ? "Real-time connected" : "Real-time disconnected"}>
      <span
        className={`w-2 h-2 rounded-full transition-colors ${
          isConnected ? "bg-green-500" : "bg-gray-400"
        }`}
      />
      <span className="text-xs text-gray-500 hidden sm:block">
        {isConnected ? "Live" : "Offline"}
      </span>
    </div>
  );
}

/**
 * Realtime notification badge for the dashboard
 */
export function RealtimeNotifications() {
  const dashboard = useRealtimeDashboard();
  const [showPanel, setShowPanel] = React.useState(false);

  if (!dashboard.hasAnyUpdates) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="relative flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100"
      >
        <span className="relative flex h-5 w-5">
          <span className="absolute inset-0 flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
          <span className="relative flex rounded-full bg-orange-500">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.035-.586 1.414L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </span>
        </span>
        <span>Live Updates</span>
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-xs text-white">
          {dashboard.orders.newOrders.length + 
           dashboard.shops.newShops.length + 
           dashboard.riders.newRiders.length + 
           dashboard.products.newProducts.length}
        </span>
      </button>

      {showPanel && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-lg z-50">
          <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Live Updates</h3>
            <button
              onClick={() => {
                setShowPanel(false);
                dashboard.clearAll();
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Dismiss all
            </button>
          </div>

          <div className="max-h-96 overflow-auto">
            {dashboard.orders.newOrders.length > 0 && (
              <section className="p-4 border-b border-gray-100">
                <h4 className="text-sm font-medium text-gray-900 mb-2">New Orders ({dashboard.orders.newOrders.length})</h4>
                <div className="space-y-2">
                  {dashboard.orders.newOrders.slice(0, 5).map((order) => (
                    <div key={order.id} className="flex items-center gap-2 p-2 rounded-lg bg-green-50">
                      <span className="text-sm font-mono text-green-700">#{order.id?.slice(0, 8).toUpperCase()}</span>
                      <span className="text-sm text-gray-600">Rs. {Number(order.total || 0).toLocaleString("en-NP")}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {dashboard.shops.newShops.length > 0 && (
              <section className="p-4 border-b border-gray-100">
                <h4 className="text-sm font-medium text-gray-900 mb-2">New Shop Applications ({dashboard.shops.newShops.length})</h4>
                <div className="space-y-2">
                  {dashboard.shops.newShops.slice(0, 5).map((shop) => (
                    <div key={shop.id} className="flex items-center gap-2 p-2 rounded-lg bg-yellow-50">
                      <span className="text-sm font-medium text-yellow-700">{shop.name}</span>
                      <span className="text-sm text-gray-500">{shop.city}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {dashboard.riders.newRiders.length > 0 && (
              <section className="p-4 border-b border-gray-100">
                <h4 className="text-sm font-medium text-gray-900 mb-2">New Rider Applications ({dashboard.riders.newRiders.length})</h4>
                <div className="space-y-2">
                  {dashboard.riders.newRiders.slice(0, 5).map((rider) => (
                    <div key={rider.user_id} className="flex items-center gap-2 p-2 rounded-lg bg-blue-50">
                      <span className="text-sm font-mono text-blue-700">Rider {rider.user_id?.slice(0, 8).toUpperCase()}</span>
                      <span className="text-sm text-gray-500">{rider.vehicle_type}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {dashboard.products.newProducts.length > 0 && (
              <section className="p-4 border-b border-gray-100">
                <h4 className="text-sm font-medium text-gray-900 mb-2">New Products ({dashboard.products.newProducts.length})</h4>
                <div className="space-y-2">
                  {dashboard.products.newProducts.slice(0, 5).map((product) => (
                    <div key={product.id} className="flex items-center gap-2 p-2 rounded-lg bg-purple-50">
                      <span className="text-sm font-medium text-purple-700">{product.name}</span>
                      <span className="text-sm text-gray-500">Rs. {Number(product.price || 0).toLocaleString("en-NP")}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {dashboard.deliveries.newDeliveries.length > 0 && (
              <section className="p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">New Deliveries ({dashboard.deliveries.newDeliveries.length})</h4>
                <div className="space-y-2">
                  {dashboard.deliveries.newDeliveries.slice(0, 5).map((delivery) => (
                    <div key={delivery.id} className="flex items-center gap-2 p-2 rounded-lg bg-orange-50">
                      <span className="text-sm font-mono text-orange-700">Delivery {delivery.id?.slice(0, 8).toUpperCase()}</span>
                      <span className="text-sm text-gray-500">{delivery.status}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Auto-refresh indicator for tables
 */
export function AutoRefreshIndicator({ 
  enabled = true, 
  interval = 30000,
  onRefresh 
}: { 
  enabled?: boolean; 
  interval?: number; 
  onRefresh?: () => void;
}) {
  const [countdown, setCountdown] = React.useState(interval / 1000);
  const [isHovering, setIsHovering] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) return;
    
    const timer = setInterval(() => {
      if (!isHovering) {
        setCountdown((prev) => {
          if (prev <= 1) {
            onRefresh?.();
            return interval / 1000;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [enabled, interval, isHovering, onRefresh]);

  if (!enabled) return null;

  return (
    <div 
      className="flex items-center gap-2 text-sm text-gray-500"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <svg className="w-4 h-4 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span>Auto-refresh in {countdown}s</span>
    </div>
  );
}
