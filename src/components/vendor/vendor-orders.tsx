"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type OrderStatus = "pending" | "confirmed" | "preparing" | "ready_for_pickup" | "picked_up" | "out_for_delivery" | "delivered" | "cancelled" | "rejected";
type VendorOrder = {
  id: string;
  status: OrderStatus;
  total: number | string;
  created_at: string;
  delivery_address_snapshot: { recipient_name?: string; phone?: string; address_line?: string; city?: string; district?: string | null; province?: string | null };
  items: { id: string; product_name_snapshot: string; unit_snapshot: string; quantity: number; line_total: number | string }[];
};
type NextStatus = "confirmed" | "rejected" | "preparing" | "ready_for_pickup";

const npr = new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("en-NP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" });
const nextStatus: Partial<Record<OrderStatus, NextStatus>> = {
  confirmed: "preparing",
  preparing: "ready_for_pickup",
};

function statusLabel(status: OrderStatus) {
  return status.replaceAll("_", " ");
}

function errorMessage(message: string) {
  if (message.includes("42501") || message.toLowerCase().includes("not allowed")) return "Your account can view orders but cannot change their status.";
  if (message.includes("22023") || message.toLowerCase().includes("transition")) return "This order has changed. Refresh the page and try again.";
  if (message.includes("P0002") || message.toLowerCase().includes("not found")) return "This order is no longer available.";
  return "We could not update this order. Please try again.";
}

export function VendorOrders({
  vendorId,
  orders,
  canManageOrders,
}: {
  vendorId: string;
  orders: VendorOrder[];
  canManageOrders: boolean;
}) {
  const router = useRouter();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [connection, setConnection] = useState<"connecting" | "live" | "offline">("connecting");
  const [isRefreshing, startRefresh] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`vendor-orders-${vendorId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `vendor_id=eq.${vendorId}` }, () => {
        startRefresh(() => router.refresh());
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `vendor_id=eq.${vendorId}` }, () => {
        startRefresh(() => router.refresh());
      })
      .subscribe((state) => {
        setConnection(state === "SUBSCRIBED" ? "live" : state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED" ? "offline" : "connecting");
      });
    return () => { void supabase.removeChannel(channel); };
  }, [router, vendorId]);

  async function updateStatus(order: VendorOrder, status: NextStatus) {
    if (!canManageOrders || savingId) return;
    setSavingId(order.id);
    setMessage("");
    try {
      const { error } = await createClient().rpc("vendor_update_order_status", {
        p_order_id: order.id,
        p_next_status: status,
        p_note: status === "rejected" ? "Rejected by shop" : null,
      });
      if (error) throw error;
      setMessage(`Order ${order.id.slice(0, 8).toUpperCase()} updated to ${statusLabel(status)}.`);
      startRefresh(() => router.refresh());
    } catch (error) {
      console.error("Could not update vendor order:", error);
      setMessage(error instanceof Error ? errorMessage(error.message) : "We could not update this order. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="vendor-orders-section" id="orders" aria-label="Shop orders">
      <div className="vendor-orders-heading">
        <div><p className="section-kicker">Order queue</p><h2>Recent orders</h2><p>Review each order and update its preparation status.</p></div>
        <span className={`live-indicator${connection === "live" ? " is-live" : connection === "offline" ? " is-offline" : ""}`}>
          <i aria-hidden="true" />{connection === "live" ? "Live orders" : connection === "offline" ? "Live updates unavailable" : "Connecting…"}
        </span>
      </div>
      {message && <p className="vendor-action-message" role="status">{message}</p>}
      {orders.length ? (
        <div className="vendor-order-list">
          {orders.map((order) => {
            const address = order.delivery_address_snapshot ?? {};
            const action = order.status === "pending" ? null : nextStatus[order.status];
            return (
              <article className="vendor-order-card" key={order.id}>
                <header className="vendor-order-card-header">
                  <div><p className="vendor-order-reference">Order {order.id.slice(0, 8).toUpperCase()}</p><time dateTime={order.created_at}>{dateTime.format(new Date(order.created_at))}</time></div>
                  <span className={`vendor-order-status status-${order.status}`}>{statusLabel(order.status)}</span>
                </header>
                <div className="vendor-order-lines">
                  {order.items.map((item) => <div className="vendor-order-line" key={item.id}><span>{item.product_name_snapshot} <small>× {item.quantity} {item.unit_snapshot}</small></span><strong>{npr.format(Number(item.line_total))}</strong></div>)}
                </div>
                <div className="vendor-order-total"><span>Order total</span><strong>{npr.format(Number(order.total))}</strong></div>
                <div className="vendor-delivery-address">
                  <strong>Deliver to {address.recipient_name || "customer"}</strong>
                  <span>{[address.address_line, address.city, address.district, address.province].filter(Boolean).join(", ") || "Delivery address unavailable"}</span>
                  {address.phone && <a href={`tel:${address.phone}`}>{address.phone}</a>}
                </div>
                {canManageOrders && order.status === "pending" && (
                  <div className="vendor-order-actions">
                    <button className="vendor-reject-button" type="button" disabled={Boolean(savingId) || isRefreshing} onClick={() => void updateStatus(order, "rejected")}>{savingId === order.id ? "Updating…" : "Reject order"}</button>
                    <button className="vendor-primary-button" type="button" disabled={Boolean(savingId) || isRefreshing} onClick={() => void updateStatus(order, "confirmed")}>{savingId === order.id ? "Updating…" : "Accept order"}</button>
                  </div>
                )}
                {canManageOrders && action && (
                  <div className="vendor-order-actions"><button className="vendor-primary-button" type="button" disabled={Boolean(savingId) || isRefreshing} onClick={() => void updateStatus(order, action)}>{savingId === order.id ? "Updating…" : action === "preparing" ? "Start preparing" : "Ready for pickup"}</button></div>
                )}
                {!canManageOrders && order.status !== "delivered" && order.status !== "cancelled" && order.status !== "rejected" && <p className="vendor-read-only-note">Your shop access is read-only for order updates.</p>}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="vendor-orders-empty"><span aria-hidden="true">▣</span><h3>No orders yet</h3><p>New customer orders for this shop will appear here.</p></div>
      )}
    </section>
  );
}
