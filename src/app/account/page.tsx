import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/customer/sign-out-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your account", robots: { index: false, follow: false } };
const npr = new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat("en-NP", { dateStyle: "medium", timeZone: "Asia/Kathmandu" });

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Faccount");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, phone, role")
    .eq("id", user.id)
    .maybeSingle();
  if (error) console.error("Could not load customer profile:", error.message);

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, status, total, created_at")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);
  if (ordersError) console.error("Could not load recent customer orders:", ordersError.message);

  return (
    <main className="simple-page">
      <header className="product-page-header">
        <Link className="brand" href="/"><span className="brand-mark">H</span><span className="brand-name">hardware<span>pasal</span></span></Link>
        <SignOutButton />
      </header>
      <section className="account-content">
        <p className="section-kicker">Your account</p>
        <h1>{profile?.full_name || "Welcome"}</h1>
        <p className="account-email">Signed in as {user.email || "your account"}</p>
        <div className="account-card">
          <div className="account-avatar" aria-hidden="true">{(profile?.full_name || user.email || "H").slice(0, 1).toUpperCase()}</div>
          <div><small>Profile</small><strong>{profile?.full_name || "Name not added yet"}</strong><span>{profile?.phone || "Phone number not added"}</span></div>
        </div>
        <div className="account-actions">
          <Link href="/cart"><span aria-hidden="true">▢</span><div><strong>Your cart</strong><small>Review items before checkout</small></div><b>→</b></Link>
          <Link href="/"><span aria-hidden="true">⌕</span><div><strong>Find hardware</strong><small>Search nearby shops</small></div><b>→</b></Link>
          {(profile?.role === "vendor_owner" || profile?.role === "vendor_staff") && <Link href="/vendor"><span aria-hidden="true">⌂</span><div><strong>Vendor dashboard</strong><small>Manage your shop orders</small></div><b>→</b></Link>}
        </div>
        <section className="account-orders" id="orders">
          <div className="account-orders-heading"><div><p className="section-kicker">Order history</p><h2>Your recent orders</h2></div><span>Latest 5</span></div>
          {orders?.length ? (
            <div className="account-order-list">
              {orders.map((order) => (
                <Link className="account-order-row" href={`/orders/${order.id}`} key={order.id}>
                  <span className="account-order-icon" aria-hidden="true">▣</span>
                  <span className="account-order-info"><strong>Order {order.id.slice(0, 8).toUpperCase()}</strong><small>{shortDate.format(new Date(order.created_at))}</small></span>
                  <span className={`account-order-status status-${order.status}`}>{order.status.replaceAll("_", " ")}</span>
                  <strong className="account-order-total">{npr.format(Number(order.total))}</strong>
                  <span className="account-order-arrow" aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="account-orders-empty"><p>{ordersError ? "Your order history could not be loaded right now." : "Your orders will appear here after checkout."}</p><Link href="/">Find hardware</Link></div>
          )}
        </section>
        <p className="account-note">We only use your account information to manage your marketplace experience and orders.</p>
      </section>
    </main>
  );
}
