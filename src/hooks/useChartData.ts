"use client";

import { useState, useEffect, useCallback } from "react";

interface OrdersTrendData {
  date: string;
  orders: number;
  revenue: number;
}

interface RevenueData {
  date: string;
  revenue: number;
}

interface OrderStatusData {
  status: string;
  count: number;
  color: string;
}

interface TopShopData {
  name: string;
  orders: number;
  revenue: number;
}

interface WeeklyComparisonData {
  week: string;
  thisWeek: number;
  lastWeek: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#3b82f6",
  preparing: "#8b5cf6",
  delivering: "#f97316",
  delivered: "#10b981",
  cancelled: "#ef4444",
};

/**
 * Hook for fetching orders trend data
 */
export function useOrdersTrend(days = 30) {
  const [data, setData] = useState<OrdersTrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/charts/orders-trend?days=${days}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const json = await response.json();
      setData(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
      // Return mock data for development
      setData(generateMockOrdersTrend(days));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook for fetching revenue data
 */
export function useRevenueData(days = 30) {
  const [data, setData] = useState<RevenueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/charts/revenue?days=${days}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const json = await response.json();
      setData(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
      setData(generateMockRevenue(days));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook for fetching order status distribution
 */
export function useOrderStatusDistribution() {
  const [data, setData] = useState<OrderStatusData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/charts/order-status`);
      if (!response.ok) throw new Error("Failed to fetch");
      const json = await response.json();
      setData(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
      setData(generateMockOrderStatus());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook for fetching top shops
 */
export function useTopShops(limit = 10) {
  const [data, setData] = useState<TopShopData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/charts/top-shops?limit=${limit}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const json = await response.json();
      setData(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
      setData(generateMockTopShops(limit));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook for fetching weekly comparison
 */
export function useWeeklyComparison(weeks = 8) {
  const [data, setData] = useState<WeeklyComparisonData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/charts/weekly-comparison?weeks=${weeks}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const json = await response.json();
      setData(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
      setData(generateMockWeeklyComparison(weeks));
    } finally {
      setLoading(false);
    }
  }, [weeks]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Combined hook for all dashboard charts
 */
export function useDashboardCharts() {
  const ordersTrend = useOrdersTrend(30);
  const revenue = useRevenueData(30);
  const orderStatus = useOrderStatusDistribution();
  const topShops = useTopShops(10);
  const weeklyComparison = useWeeklyComparison(8);

  const loading = ordersTrend.loading || revenue.loading || orderStatus.loading || topShops.loading || weeklyComparison.loading;
  const error = ordersTrend.error || revenue.error || orderStatus.error || topShops.error || weeklyComparison.error;

  const refetch = useCallback(() => {
    ordersTrend.refetch();
    revenue.refetch();
    orderStatus.refetch();
    topShops.refetch();
    weeklyComparison.refetch();
  }, [ordersTrend, revenue, orderStatus, topShops, weeklyComparison]);

  return {
    ordersTrend: ordersTrend.data,
    revenue: revenue.data,
    orderStatus: orderStatus.data,
    topShops: topShops.data,
    weeklyComparison: weeklyComparison.data,
    loading,
    error,
    refetch,
  };
}

// ============================================
// Mock Data Generators (for development)
// ============================================

function generateMockOrdersTrend(days: number): OrdersTrendData[] {
  const data: OrdersTrendData[] = [];
  const now = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Simulate realistic order patterns
    const baseOrders = 10 + Math.sin(i / 7 * Math.PI * 2) * 5;
    const weekendBoost = (date.getDay() === 0 || date.getDay() === 6) ? 8 : 0;
    const orders = Math.max(0, Math.round(baseOrders + weekendBoost + (Math.random() - 0.5) * 6));
    const revenue = orders * (1500 + Math.random() * 2000);
    
    data.push({
      date: date.toISOString().split("T")[0],
      orders,
      revenue: Math.round(revenue),
    });
  }
  
  return data;
}

function generateMockRevenue(days: number): RevenueData[] {
  const data: RevenueData[] = [];
  const now = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const baseRevenue = 25000 + Math.sin(i / 7 * Math.PI * 2) * 10000;
    const weekendBoost = (date.getDay() === 0 || date.getDay() === 6) ? 15000 : 0;
    const revenue = Math.max(0, Math.round(baseRevenue + weekendBoost + (Math.random() - 0.5) * 8000));
    
    data.push({
      date: date.toISOString().split("T")[0],
      revenue,
    });
  }
  
  return data;
}

function generateMockOrderStatus(): OrderStatusData[] {
  return [
    { status: "Delivered", count: 142, color: STATUS_COLORS.delivered },
    { status: "Delivering", count: 23, color: STATUS_COLORS.delivering },
    { status: "Preparing", count: 18, color: STATUS_COLORS.preparing },
    { status: "Confirmed", count: 31, color: STATUS_COLORS.confirmed },
    { status: "Pending", count: 12, color: STATUS_COLORS.pending },
    { status: "Cancelled", count: 5, color: STATUS_COLORS.cancelled },
  ];
}

function generateMockTopShops(limit: number): TopShopData[] {
  const shops = [
    "Kathmandu Hardware", "Pokhara Tools", "Biratnagar Supply", "Lalitpur Builders",
    "Bhaktapur Traders", "Dharan Equipment", "Butwal Hardware", "Hetauda Supplies",
    "Narayanghat Tools", "Birgunj Equipment", "Dhangadhi Hardware", "Mahendranagar Supply",
  ];
  
  return shops.slice(0, limit).map((name, i) => ({
    name,
    orders: Math.round(100 - i * 5 + Math.random() * 20),
    revenue: Math.round((100 - i * 5 + Math.random() * 20) * (2000 + Math.random() * 3000)),
  }));
}

function generateMockWeeklyComparison(weeks: number): WeeklyComparisonData[] {
  const data: WeeklyComparisonData[] = [];
  const now = new Date();
  
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - i * 7);
    
    const baseOrders = 60 + Math.sin(i / 4 * Math.PI * 2) * 15;
    const thisWeek = Math.max(0, Math.round(baseOrders + (Math.random() - 0.5) * 20));
    const lastWeek = Math.max(0, Math.round(baseOrders + (Math.random() - 0.5) * 20));
    
    data.push({
      week: `Week ${weekStart.getDate()}-${weekStart.getDate() + 6}`,
      thisWeek,
      lastWeek,
    });
  }
  
  return data;
}
