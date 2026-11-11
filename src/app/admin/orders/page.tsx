"use client";

import { useEffect, useState } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ExportButton } from "@/components/admin/export-button";

export const metadata: Metadata = { title: "Orders - Admin", robots: { index: false, follow: false } };

type Order = {
  id: string;
  vendor_id: string;
  total: number;
  status: string;
  created_at: string;
  delivery_address_snapshot: {
    address_line?: string;
    city?: string;
    phone?: string;
  };
};

type VendorMap = Map<string, string>;

export default function OrdersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const status = searchParams.get("status") || "";
  const shop = searchParams.get("shop") || "";
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [vendorNames, setVendorNames] = useState<VendorMap>(new Map());
  const [loading, setLoading] = useState(true);

  const statusOptions = [
    { value: "", label: "All Status" },
    { value: "pending", label: "Pending" },
    { value: "confirmed", label: "Confirmed" },
    { value: "preparing", label: "Preparing" },
    { value: "delivering", label: "Delivering" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const statusConfig = {
    pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700" },
    confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-700" },
    preparing: { label: "Preparing", className: "bg-purple-100 text-purple-700" },
    delivering: { label: "Delivering", className: "bg-orange-100 text-orange-700" },
    delivered: { label: "Delivered", className: "bg-green-100 text-green-700" },
    cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700" },
  } as const;

  async function fetchData() {
    setLoading(true);
    try {
      const supabase = createClient();
      let query = supabase
        .from("orders")
        .select("id, vendor_id, total, status, created_at, delivery_address_snapshot")
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }
      if (shop) {
        query = query.eq("vendor_id", shop);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      
      const ordersData = (data as Order[]) ?? [];
      setOrders(ordersData);
      
      const vendorIds = [...new Set(ordersData.map(o => o.vendor_id))];
      if (vendorIds.length > 0) {
        const { data: vendors, error: vendorError } = await supabase
          .from("vendors")
          .select("id, name")
          .in("id", vendorIds);
        if (!vendorError && vendors) {
          setVendorNames(new Map(vendors.map(v => [v.id, v.name])));
        }
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [status, shop]);

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (newStatus) {
      params.set("status", newStatus);
    } else {
      params.delete("status");
    }
    router.push(`/admin/orders?${params.toString()}`);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
            <p className="text-gray-600 mt-1">Monitor and manage marketplace orders</p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto" />
            <p className="mt-2 text-gray-600">Loading orders...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600 mt-1">Monitor and manage marketplace orders</p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            apiUrl="/api/admin/export/orders"
            filename={`orders_${status || "all"}`}
            label="Export"
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
            variant="outline"
          />
          <select
            value={status}
            onChange={handleStatusChange}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {orders.length === 0 ? (
          <div className="py-12 text-center">
            <span className="text-4xl" aria-hidden="true">📦</span>
            <h3 className="mt-2 text-lg font-medium text-gray-900">No orders found</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" role="table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Shop</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link href={`/admin/orders/${order.id}`} className="font-mono text-sm text-orange-600 hover:text-orange-700">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{vendorNames.get(order.vendor_id) || "Unknown"}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {order.delivery_address_snapshot?.address_line || "Customer"}
                      <br />
                      <span className="text-gray-500">{order.delivery_address_snapshot?.city || ""}</span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      Rs. {Number(order.total).toLocaleString("en-NP")}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[order.status as keyof typeof statusConfig]?.className || "bg-gray-100 text-gray-700"}`}>
                        {statusConfig[order.status as keyof typeof statusConfig]?.label || order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleString("en-NP", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: "Asia/Kathmandu",
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/admin/orders/${order.id}`} className="text-sm text-orange-600 hover:text-orange-700 font-medium">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
