"use client";

import { useMemo, useState } from "react";

export type AdminOrder = {
  id: string;
  status: string;
  total: number | string;
  created_at: string;
  customer_snapshot: { recipient_name?: string; phone?: string; city?: string; address_line?: string };
  vendor_name: string;
};

const dateTime = new Intl.DateTimeFormat("en-NP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" });

export function RecentOrders({ orders }: { orders: AdminOrder[] }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const statuses = useMemo(() => [...new Set(orders.map((order) => order.status))].sort(), [orders]);
  const filtered = statusFilter === "all" ? orders : orders.filter((order) => order.status === statusFilter);
  return <section className="admin-rider-section" id="orders">
    <div className="admin-page-title"><div><p className="section-kicker">Order operations</p><h2>Recent orders</h2><p>Newest orders across the marketplace.</p></div><label className="admin-filter-label">Filter status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label></div>
    {filtered.length ? <div className="admin-order-list">{filtered.map((order) => <article key={order.id}><header><div><strong>Order {order.id.slice(0, 8).toUpperCase()}</strong><time>{dateTime.format(new Date(order.created_at))}</time></div><span className={`admin-finance-status finance-${order.status}`}>{order.status.replaceAll("_", " ")}</span></header><div className="admin-order-details"><div><small>Shop</small><strong>{order.vendor_name}</strong></div><div><small>Customer</small><strong>{order.customer_snapshot?.recipient_name || "Customer"}</strong><span>{order.customer_snapshot?.phone || "No phone"}</span></div><div><small>Delivery</small><span>{[order.customer_snapshot?.address_line, order.customer_snapshot?.city].filter(Boolean).join(", ") || "Address unavailable"}</span></div><strong>Rs. {Number(order.total).toLocaleString("en-NP")}</strong></div></article>)}</div> : <p className="admin-subtle-empty">No recent orders match this status.</p>}
  </section>;
}
