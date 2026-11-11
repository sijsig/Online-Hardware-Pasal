"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getDirectionsUrl } from "@/lib/maps/directions";

type CustomerSnapshot = { recipient_name?: string; phone?: string; address_line?: string; city?: string; district?: string | null; province?: string | null; latitude?: string | number; longitude?: string | number };
type ShopSnapshot = { name?: string; phone?: string; address_line?: string; city?: string; latitude?: string | number | null; longitude?: string | number | null };
export type RiderDelivery = {
  assignment_id: string;
  order_id: string;
  assignment_status: "offered" | "accepted" | "declined" | "picked_up" | "delivered" | "cancelled";
  order_status: string;
  total: number | string;
  created_at: string;
  customer_snapshot: CustomerSnapshot;
  items_snapshot: { name: string; quantity: number; unit: string }[];
  shop_snapshot: ShopSnapshot;
  distance_to_vendor_meters: number | null;
};

const npr = new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("en-NP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" });

export function RiderApplicationForm() {
  const router = useRouter();
  const [vehicle, setVehicle] = useState("motorcycle");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const { error } = await createClient().rpc("apply_for_rider", { p_vehicle_type: vehicle });
      if (error) throw error;
      router.refresh();
    } catch (error) {
      console.error("Rider application failed:", error);
      setMessage("We could not submit your application. Refresh the page and try again.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="rider-apply-card"><span className="rider-icon" aria-hidden="true">➜</span><p className="section-kicker">Join the delivery network</p><h1>Deliver with Hardware Pasal</h1><p>Apply to deliver orders from nearby hardware shops. The team will review your application before you can go online.</p><form onSubmit={submit}><label>Vehicle type<select value={vehicle} onChange={(event) => setVehicle(event.target.value)}><option value="motorcycle">Motorcycle</option><option value="scooter">Scooter</option><option value="bicycle">Bicycle</option><option value="car">Car</option><option value="other">Other</option></select></label><button type="submit" disabled={saving}>{saving ? "Submitting…" : "Submit rider application"}</button>{message ? <p role="status">{message}</p> : null}</form></section>;
}

export function RiderDashboard({ riderId, status, deliveries, deliveryError }: { riderId: string; status: "offline" | "available" | "busy" | "suspended"; deliveries: RiderDelivery[]; deliveryError: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const lastLocationSent = useRef(0);
  const sharingLocation = (status === "available" || status === "busy") && typeof navigator !== "undefined" && Boolean(navigator.geolocation);

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => router.refresh();
    const channel = supabase.channel(`rider-deliveries-${riderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_assignments", filter: `rider_id=eq.${riderId}` }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "riders", filter: `user_id=eq.${riderId}` }, refresh)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [router, riderId]);

  useEffect(() => {
    if (status !== "available" && status !== "busy") return;
    if (!navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(({ coords }) => {
      const now = Date.now();
      if (now - lastLocationSent.current < 30000) return;
      lastLocationSent.current = now;
      void createClient().rpc("rider_update_location", {
        p_latitude: coords.latitude,
        p_longitude: coords.longitude,
        p_accuracy_meters: coords.accuracy,
      }).then(({ error }) => {
        if (error) setMessage("We could not update your location. Check location permission and try again.");
        else setMessage("");
      });
    }, () => setMessage("Allow location access so nearby delivery offers can reach you."), { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
    return () => { navigator.geolocation.clearWatch(watch); };
  }, [status]);

  async function setAvailability(available: boolean) {
    setSaving("availability");
    setMessage("");
    try {
      const { error } = await createClient().rpc("rider_set_availability", { p_available: available });
      if (error) throw error;
      router.refresh();
    } catch (error) {
      console.error("Rider availability update failed:", error);
      setMessage(error instanceof Error && error.message.toLowerCase().includes("delivery") ? "Finish or decline your active delivery before changing availability." : "We could not change your availability. Try again.");
    } finally { setSaving(""); }
  }

  async function runAction(delivery: RiderDelivery, action: "accept" | "decline" | "pickup" | "deliver") {
    setSaving(delivery.assignment_id);
    setMessage("");
    const functionName = action === "accept" ? "rider_accept_assignment" : action === "decline" ? "rider_decline_assignment" : "rider_update_delivery";
    const args = action === "accept" || action === "decline"
      ? { p_assignment_id: delivery.assignment_id }
      : { p_assignment_id: delivery.assignment_id, p_action: action, p_cash_collected: action === "deliver" };
    try {
      const { error } = await createClient().rpc(functionName, args);
      if (error) throw error;
      setMessage(action === "accept" ? "Delivery accepted." : action === "decline" ? "Offer declined." : action === "pickup" ? "Pickup confirmed." : "Delivery completed.");
      router.refresh();
    } catch (error) {
      console.error("Rider delivery action failed:", error);
      setMessage("This delivery changed or could not be updated. Refresh and try again.");
    } finally { setSaving(""); }
  }

  const active = deliveries.find((delivery) => ["offered", "accepted", "picked_up"].includes(delivery.assignment_status));
  const completed = deliveries.filter((delivery) => delivery.assignment_status === "delivered");

  return <>
    <div className="rider-dashboard-title"><div><p className="section-kicker">Rider workspace</p><h1>Your deliveries</h1><p>Accept nearby offers, confirm pickup, and complete deliveries.</p></div><span className={`rider-status-pill rider-${status}`}>{status.replaceAll("_", " ")}</span></div>
    <div className="rider-online-card"><div><strong>{status === "available" ? "You’re online" : status === "busy" ? "Delivery in progress" : "You’re offline"}</strong><p>{sharingLocation ? "Sharing your location while this page is open." : "Go online to share your location and receive nearby offers."}</p></div><button type="button" disabled={Boolean(saving) || status === "busy" || status === "suspended"} onClick={() => void setAvailability(status !== "available")}>{saving === "availability" ? "Updating…" : status === "available" ? "Go offline" : status === "suspended" ? "Account suspended" : "Go online"}</button></div>
    {message ? <p className="rider-message" role="status">{message}</p> : null}
    {deliveryError ? <p className="vendor-page-error" role="alert">Your delivery list could not be loaded. Refresh to try again.</p> : null}
    {active ? <DeliveryCard delivery={active} saving={saving === active.assignment_id} action={(next) => void runAction(active, next)} /> : <section className="rider-empty"><span aria-hidden="true">⌖</span><h2>No active delivery</h2><p>Keep your availability on. New offers will appear here as nearby shops confirm orders.</p></section>}
    {completed.length > 0 && <section className="rider-history"><h2>Recent completed deliveries</h2>{completed.slice(0, 10).map((delivery) => <div key={delivery.assignment_id}><span>Order {delivery.order_id.slice(0, 8).toUpperCase()} · {dateTime.format(new Date(delivery.created_at))}</span><strong>{npr.format(Number(delivery.total))}</strong></div>)}</section>}
  </>;
}

function DeliveryCard({ delivery, saving, action }: { delivery: RiderDelivery; saving: boolean; action: (action: "accept" | "decline" | "pickup" | "deliver") => void }) {
  const customer = delivery.customer_snapshot ?? {};
  const shop = delivery.shop_snapshot ?? {};
  const shopRoute = getDirectionsUrl(shop.latitude, shop.longitude);
  const customerRoute = getDirectionsUrl(customer.latitude, customer.longitude);
  return <article className="rider-delivery-card"><header><div><p className="section-kicker">{delivery.assignment_status === "offered" ? "New delivery offer" : "Active delivery"}</p><h2>Order {delivery.order_id.slice(0, 8).toUpperCase()}</h2></div><span className="vendor-order-status status-confirmed">{delivery.assignment_status.replaceAll("_", " ")}</span></header><div className="rider-delivery-meta"><span>Order total</span><strong>{npr.format(Number(delivery.total))}</strong><time>{dateTime.format(new Date(delivery.created_at))}</time></div>
    {delivery.items_snapshot?.length ? <section><h3>Order items</h3>{delivery.items_snapshot.map((item, index) => <p className="rider-item-line" key={`${item.name}-${index}`}>{item.name} · {item.quantity} {item.unit}</p>)}</section> : null}
    <section><h3>Pickup from</h3><strong>{shop.name || "Hardware shop"}</strong><p>{[shop.address_line, shop.city].filter(Boolean).join(", ")}</p>{shop.phone ? <a href={`tel:${shop.phone}`}>{shop.phone}</a> : null}{shopRoute ? <a className="rider-route-link" href={shopRoute} target="_blank" rel="noreferrer">Navigate to shop ↗</a> : null}</section>
    <section><h3>Deliver to</h3><strong>{customer.recipient_name || "Customer"}</strong><p>{[customer.address_line, customer.city, customer.district, customer.province].filter(Boolean).join(", ")}</p>{customer.phone ? <a href={`tel:${customer.phone}`}>{customer.phone}</a> : null}{customerRoute ? <a className="rider-route-link" href={customerRoute} target="_blank" rel="noreferrer">Navigate to customer ↗</a> : null}</section>
    {delivery.distance_to_vendor_meters != null ? <p className="rider-distance">{(delivery.distance_to_vendor_meters / 1000).toFixed(1)} km from your last location to the shop</p> : null}
    <div className="rider-actions">{delivery.assignment_status === "offered" ? <><button className="rider-decline-button" disabled={saving} onClick={() => action("decline")}>Decline offer</button><button disabled={saving} onClick={() => action("accept")}>{saving ? "Saving…" : "Accept delivery"}</button></> : null}{delivery.assignment_status === "accepted" ? <p>{delivery.order_status === "ready_for_pickup" ? <button disabled={saving} onClick={() => action("pickup")}>{saving ? "Saving…" : "Confirm pickup"}</button> : "Waiting for the shop to mark the order ready for pickup."}</p> : null}{delivery.assignment_status === "picked_up" ? <div className="rider-cash-confirmation"><p>Collect {npr.format(Number(delivery.total))} cash from the customer before completing delivery.</p><button disabled={saving} onClick={() => action("deliver")}>{saving ? "Saving…" : "Confirm cash received & delivery"}</button></div> : null}</div>
  </article>;
}
