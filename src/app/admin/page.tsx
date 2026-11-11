"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useDashboardCharts } from "@/hooks/useChartData";
import {
  OrdersTrendChart,
  RevenueAreaChart,
  OrderStatusPieChart,
  TopShopsBarChart,
  WeeklyComparisonChart,
  MetricCard,
} from "@/components/admin/charts";
import { DashboardSkeleton } from "@/components/admin/skeletons";
import { DashboardMetrics } from "@/types/admin";

async function getMetrics(): Promise<DashboardMetrics> {
  const response = await fetch("/api/admin/metrics");
  if (!response.ok) return getDefaultMetrics();
  const json = await response.json();
  return json.data || getDefaultMetrics();
}

function getDefaultMetrics(): DashboardMetrics {
  return {
    today_orders: 0,
    today_order_value: 0,
    today_commission: 0,
    active_vendors: 0,
    available_riders: 0,
    pending_orders: 0,
    active_deliveries: 0,
    pending_shop_applications: 0,
    pending_rider_applications: 0,
  };
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(getDefaultMetrics());
  const [showCharts, setShowCharts] = useState(true);
  
  const {
    ordersTrend,
    revenue,
    orderStatus,
    topShops,
    weeklyComparison,
    loading: chartsLoading,
    error: chartsError,
  } = useDashboardCharts();

  // Fetch metrics on mount
  React.useEffect(() => {
    getMetrics().then(setMetrics);
  }, []);

  const quickStats = [
    {
      label: "Today's Orders",
      value: metrics.today_orders,
      change: metrics.today_orders > 0 ? `+${metrics.today_orders} vs yesterday` : "No orders yet",
      changeType: "positive" as const,
      href: "/admin/orders",
      icon: "📦",
    },
    {
      label: "Revenue Today",
      value: `Rs. ${Number(metrics.today_order_value).toLocaleString("en-NP")}`,
      href: "/admin/payments",
      icon: "💰",
    },
    {
      label: "Commission",
      value: `Rs. ${Number(metrics.today_commission).toLocaleString("en-NP")}`,
      href: "/admin/payments",
      icon: "📈",
    },
    {
      label: "Pending Shops",
      value: metrics.pending_shop_applications,
      change: metrics.pending_shop_applications > 0 ? "Review needed" : "All caught up",
      changeType: metrics.pending_shop_applications > 0 ? "negative" as const : "positive" as const,
      href: "/admin/shops?tab=pending",
      icon: "🏪",
    },
    {
      label: "Active Deliveries",
      value: metrics.active_deliveries,
      href: "/admin/orders?status=delivering",
      icon: "🚚",
    },
    {
      label: "Available Riders",
      value: metrics.available_riders,
      href: "/admin/riders",
      icon: "🛵",
    },
  ];

  if (chartsLoading && showCharts) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Marketplace overview & analytics</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCharts(!showCharts)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {showCharts ? "📊" : "📈"} {showCharts ? "Hide Charts" : "Show Charts"}
          </button>
          <Link
            href="/admin/shops?tab=pending"
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          >
            <span aria-hidden="true">➕</span>
            Review Applications
          </Link>
        </div>
      </div>

      {/* Quick stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {quickStats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-start justify-between">
              <span className="text-2xl" aria-hidden="true">{stat.icon}</span>
              {stat.change && (
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    stat.changeType === "positive"
                      ? "bg-green-100 text-green-700"
                      : stat.changeType === "negative"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {stat.change}
                </span>
              )}
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
          </Link>
        ))}
      </div>

      {/* Charts Section */}
      {showCharts && (
        <div className="space-y-6">
          {/* Row 1: Orders Trend + Revenue Area */}
          <div className="grid gap-6 lg:grid-cols-2">
            <OrdersTrendChart data={ordersTrend} height={300} />
            <RevenueAreaChart data={revenue} height={300} />
          </div>

          {/* Row 2: Order Status + Weekly Comparison */}
          <div className="grid gap-6 lg:grid-cols-2">
            <OrderStatusPieChart data={orderStatus} height={300} />
            <WeeklyComparisonChart data={weeklyComparison} height={300} />
          </div>

          {/* Row 3: Top Shops (full width) */}
          <TopShopsBarChart data={topShops} height={350} />
        </div>
      )}

      {/* Pending Actions */}
      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Needs Attention</h2>
        </div>
        <div className="p-6 space-y-4">
          {metrics.pending_shop_applications > 0 && (
            <Link
              href="/admin/shops?tab=pending"
              className="flex items-center gap-3 rounded-lg p-3 bg-orange-50 border border-orange-200 hover:bg-orange-100"
            >
              <span className="text-2xl" aria-hidden="true">🏪</span>
              <div>
                <p className="font-medium text-gray-900">
                  {metrics.pending_shop_applications} shop application{metrics.pending_shop_applications !== 1 ? "s" : ""} pending
                </p>
                <p className="text-sm text-gray-500">Review & approve</p>
              </div>
            </Link>
          )}
          {metrics.pending_rider_applications > 0 && (
            <Link
              href="/admin/riders?tab=pending"
              className="flex items-center gap-3 rounded-lg p-3 bg-blue-50 border border-blue-200 hover:bg-blue-100"
            >
              <span className="text-2xl" aria-hidden="true">🛵</span>
              <div>
                <p className="font-medium text-gray-900">
                  {metrics.pending_rider_applications} rider application{metrics.pending_rider_applications !== 1 ? "s" : ""} pending
                </p>
                <p className="text-sm text-gray-500">Approve riders</p>
              </div>
            </Link>
          )}
          {metrics.pending_orders > 0 && (
            <Link
              href="/admin/orders?status=pending"
              className="flex items-center gap-3 rounded-lg p-3 bg-yellow-50 border border-yellow-200 hover:bg-yellow-100"
            >
              <span className="text-2xl" aria-hidden="true">📦</span>
              <div>
                <p className="font-medium text-gray-900">
                  {metrics.pending_orders} order{metrics.pending_orders !== 1 ? "s" : ""} awaiting shop confirmation
                </p>
                <p className="text-sm text-gray-500">Follow up with shops</p>
              </div>
            </Link>
          )}
          {metrics.pending_shop_applications === 0 &&
            metrics.pending_rider_applications === 0 &&
            metrics.pending_orders === 0 && (
              <div className="text-center py-8 text-gray-500">
                <span className="text-4xl" aria-hidden="true">✨</span>
                <p className="mt-2 font-medium">All caught up!</p>
                <p className="text-sm">No pending actions at the moment.</p>
              </div>
            )}
        </div>
      </section>

      {/* Quick Links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/shops" className="rounded-xl border border-gray-200 bg-white p-6 hover:border-orange-300 transition-colors">
          <p className="text-sm text-gray-500">Total Shops</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{metrics.active_vendors}</p>
          <p className="mt-1 text-sm text-green-600">Active</p>
        </Link>
        <Link href="/admin/riders" className="rounded-xl border border-gray-200 bg-white p-6 hover:border-blue-300 transition-colors">
          <p className="text-sm text-gray-500">Total Riders</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{metrics.available_riders}</p>
          <p className="mt-1 text-sm text-green-600">Available</p>
        </Link>
        <Link href="/admin/orders" className="rounded-xl border border-gray-200 bg-white p-6 hover:border-purple-300 transition-colors">
          <p className="text-sm text-gray-500">Total Orders</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{metrics.today_orders}</p>
          <p className="mt-1 text-sm text-gray-500">Today</p>
        </Link>
        <Link href="/admin/payments" className="rounded-xl border border-gray-200 bg-white p-6 hover:border-green-300 transition-colors">
          <p className="text-sm text-gray-500">Revenue Today</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">Rs. {Number(metrics.today_order_value).toLocaleString("en-NP")}</p>
          <p className="mt-1 text-sm text-gray-500">Commission: Rs. {Number(metrics.today_commission).toLocaleString("en-NP")}</p>
        </Link>
      </div>
    </div>
  );
}
