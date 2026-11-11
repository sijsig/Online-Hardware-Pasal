"use client";

import React from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#f97316", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b"];

/**
 * Orders Trend Chart - Line chart showing orders over time
 */
interface OrdersTrendChartProps {
  data: Array<{ date: string; orders: number; revenue: number }>;
  height?: number;
}

export function OrdersTrendChart({ data, height = 250 }: OrdersTrendChartProps) {
  if (!data.length) return <ChartEmptyState />;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Orders & Revenue Trend</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            stroke="#9ca3af"
            fontSize={12}
            tick={{ fill: "#6b7280" }}
            tickFormatter={(value) => value.split("T")[0]}
          />
          <YAxis
            stroke="#9ca3af"
            fontSize={12}
            tick={{ fill: "#6b7280" }}
            tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(1)}k` : value}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            }}
            formatter={(value: number, name: string) => [
              name === "revenue" ? `Rs. ${value.toLocaleString("en-NP")}` : value,
              name === "orders" ? "Orders" : "Revenue",
            ]}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="orders"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2 }}
            activeDot={{ r: 6, strokeWidth: 3 }}
            name="Orders"
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2 }}
            activeDot={{ r: 6, strokeWidth: 3 }}
            name="Revenue"
            yAxisId="right"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Revenue Area Chart - Area chart for revenue visualization
 */
interface RevenueAreaChartProps {
  data: Array<{ date: string; revenue: number }>;
  height?: number;
}

export function RevenueAreaChart({ data, height = 200 }: RevenueAreaChartProps) {
  if (!data.length) return <ChartEmptyState />;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Overview</h3>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            stroke="#9ca3af"
            fontSize={12}
            tick={{ fill: "#6b7280" }}
            tickFormatter={(value) => value.split("T")[0]}
          />
          <YAxis
            stroke="#9ca3af"
            fontSize={12}
            tick={{ fill: "#6b7280" }}
            tickFormatter={(value) => `Rs. ${(value/1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
            formatter={(value: number) => [`Rs. ${value.toLocaleString("en-NP")}`, "Revenue"]}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            fill="url(#colorRevenue)"
            stroke="#f97316"
            strokeWidth={2}
            name="Revenue"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Order Status Distribution - Pie chart
 */
interface OrderStatusPieChartProps {
  data: Array<{ status: string; count: number; color?: string }>;
  height?: number;
}

export function OrderStatusPieChart({ data, height = 250 }: OrderStatusPieChartProps) {
  if (!data.length) return <ChartEmptyState />;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Status Distribution</h3>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            fill="#8884d8"
            paddingAngle={2}
            dataKey="count"
            nameKey="status"
            label={({ status, count, percent }: { status: string; count: number; percent: number }) => 
              `${status}: ${count} (${(percent * 100).toFixed(0)}%)`}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
            formatter={(value: number, name: string) => [value, name]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Top Shops Bar Chart - Horizontal bar chart
 */
interface TopShopsBarChartProps {
  data: Array<{ name: string; orders: number; revenue: number }>;
  height?: number;
}

export function TopShopsBarChart({ data, height = 300 }: TopShopsBarChartProps) {
  if (!data.length) return <ChartEmptyState />;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Shops by Orders</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            type="number"
            stroke="#9ca3af"
            fontSize={12}
            tick={{ fill: "#6b7280" }}
            tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(1)}k` : value}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            stroke="#9ca3af"
            fontSize={12}
            tick={{ fill: "#6b7280" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
            formatter={(value: number, name: string) => [
              name === "revenue" ? `Rs. ${value.toLocaleString("en-NP")}` : value,
              name === "orders" ? "Orders" : "Revenue",
            ]}
          />
          <Legend />
          <Bar dataKey="orders" fill="#f97316" name="Orders" radius={[0, 4, 4, 0]} />
          <Bar dataKey="revenue" fill="#10b981" name="Revenue" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Weekly Comparison Chart - Grouped bar chart
 */
interface WeeklyComparisonChartProps {
  data: Array<{ week: string; thisWeek: number; lastWeek: number }>;
  height?: number;
}

export function WeeklyComparisonChart({ data, height = 250 }: WeeklyComparisonChartProps) {
  if (!data.length) return <ChartEmptyState />;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Comparison</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="week"
            stroke="#9ca3af"
            fontSize={12}
            tick={{ fill: "#6b7280" }}
          />
          <YAxis
            stroke="#9ca3af"
            fontSize={12}
            tick={{ fill: "#6b7280" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
          />
          <Legend />
          <Bar dataKey="thisWeek" fill="#f97316" name="This Week" radius={[4, 4, 0, 0]} />
          <Bar dataKey="lastWeek" fill="#9ca3af" name="Last Week" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Empty state for charts when no data
 */
function ChartEmptyState() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
      <div className="text-4xl mb-2">📊</div>
      <p className="text-gray-500">No data available for this period</p>
    </div>
  );
}

/**
 * Metric Cards with mini charts (sparkline-style)
 */
interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
  sparklineData?: number[];
  color?: string;
}

export function MetricCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon,
  sparklineData,
  color = "#f97316",
}: MetricCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          {change && (
            <p className={`mt-1 text-sm font-medium ${
              changeType === "positive" ? "text-green-600" :
              changeType === "negative" ? "text-red-600" :
              "text-gray-600"
            }`}>
              {change}
            </p>
          )}
        </div>
        {icon && <div className="text-3xl">{icon}</div>}
      </div>
      {sparklineData && sparklineData.length > 1 && (
        <div className="mt-4 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData.map((v, i) => ({ value: v, index: i }))} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`colorSpark-${color}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                fill={`url(#colorSpark-${color})`}
                stroke={color}
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
