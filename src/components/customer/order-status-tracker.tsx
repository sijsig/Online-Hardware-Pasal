"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const milestones = [
  "pending",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "picked_up",
  "out_for_delivery",
  "delivered",
] as const;

type OrderStatus = (typeof milestones)[number] | "cancelled" | "rejected";
type StatusEntry = { status: OrderStatus; createdAt: string; note: string | null };

function label(status: string) {
  return status.replaceAll("_", " ");
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-NP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kathmandu",
  }).format(new Date(value));
}

export function OrderStatusTracker({
  orderId,
  initialStatus,
  initialHistory,
}: {
  orderId: string;
  initialStatus: OrderStatus;
  initialHistory: StatusEntry[];
}) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [history, setHistory] = useState(initialHistory);
  const [connection, setConnection] = useState<"connecting" | "live" | "offline">("connecting");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`customer-order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => setStatus(payload.new.status as OrderStatus),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_status_history", filter: `order_id=eq.${orderId}` },
        (payload) => {
          const entry = payload.new as { to_status: OrderStatus; created_at: string; note: string | null };
          const nextEntry = { status: entry.to_status, createdAt: entry.created_at, note: entry.note };
          setStatus(entry.to_status);
          setHistory((current) => current.some((item) => item.createdAt === nextEntry.createdAt)
            ? current
            : [...current, nextEntry].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
        },
      )
      .subscribe((state) => {
        setConnection(state === "SUBSCRIBED" ? "live" : state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED" ? "offline" : "connecting");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderId]);

  const isTerminalException = status === "cancelled" || status === "rejected";
  const currentIndex = milestones.indexOf(status as (typeof milestones)[number]);

  return (
    <section className="order-tracking-card" aria-label="Order tracking">
      <div className="order-tracking-heading">
        <div>
          <p className="section-kicker">Order status</p>
          <h2>{label(status)}</h2>
        </div>
        <span className={`live-indicator${connection === "live" ? " is-live" : connection === "offline" ? " is-offline" : ""}`}>
          <i aria-hidden="true" />{connection === "live" ? "Live updates" : connection === "offline" ? "Live updates unavailable" : "Connecting…"}
        </span>
      </div>

      {isTerminalException ? (
        <p className="order-terminal-message">
          {status === "cancelled" ? "This order was cancelled." : "The shop could not fulfil this order."}
        </p>
      ) : (
        <ol className="order-milestones">
          {milestones.map((milestone, index) => {
            const completed = index <= currentIndex;
            const current = index === currentIndex;
            return (
              <li className={`${completed ? "is-complete" : ""}${current ? " is-current" : ""}`} key={milestone}>
                <span className="milestone-marker" aria-hidden="true">{completed ? "✓" : ""}</span>
                <span>{label(milestone)}</span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="order-timeline" aria-live="polite" aria-label="Status update history">
        <h3>Updates</h3>
        {history.length ? history.map((entry) => (
          <article className="order-timeline-entry" key={`${entry.createdAt}-${entry.status}`}>
            <span className="timeline-dot" aria-hidden="true" />
            <div><strong>{label(entry.status)}</strong>{entry.note && <p>{entry.note}</p>}<time dateTime={entry.createdAt}>{dateLabel(entry.createdAt)}</time></div>
          </article>
        )) : <p className="order-timeline-empty">Updates will appear here when the shop changes your order status.</p>}
      </div>
    </section>
  );
}
