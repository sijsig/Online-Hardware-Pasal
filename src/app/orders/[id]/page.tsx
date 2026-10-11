import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order details", robots: { index: false, follow: false } };

const npr = new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 });

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/orders/${id}`)}`);

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status, payment_method, payment_status, subtotal, delivery_fee, total, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !order) notFound();

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("id, product_name_snapshot, unit_snapshot, unit_price_snapshot, quantity, line_total")
    .eq("order_id", id)
    .order("created_at", { ascending: true });
  if (itemsError) console.error("Could not load order items:", itemsError.message);

  return (
    <main className="simple-page">
      <header className="product-page-header"><Link className="brand" href="/"><span className="brand-mark">H</span><span className="brand-name">hardware<span>pasal</span></span></Link><Link className="back-link" href="/account">Your account</Link></header>
      <section className="order-confirmation">
        <div className="order-success-mark" aria-hidden="true">✓</div>
        <p className="section-kicker">Order received</p>
        <h1>Thanks, your order is placed.</h1>
        <p className="order-id">Order reference <strong>{order.id.slice(0, 8).toUpperCase()}</strong></p>
        <div className="order-status-card"><span className="status-dot" /><div><strong>{order.status.replaceAll("_", " ")}</strong><small>We’ll update this page as the shop confirms your order.</small></div><span className="payment-method">Cash on delivery</span></div>
        <section className="order-items-card">
          <h2>Order summary</h2>
          {(items ?? []).map((item) => <div className="checkout-line" key={item.id}><span>{item.product_name_snapshot} × {item.quantity}<small>{npr.format(Number(item.unit_price_snapshot))} / {item.unit_snapshot}</small></span><strong>{npr.format(Number(item.line_total))}</strong></div>)}
          <div className="summary-divider" />
          <div className="checkout-line"><span>Items subtotal</span><strong>{npr.format(Number(order.subtotal))}</strong></div>
          <div className="checkout-line"><span>Delivery fee</span><strong>{npr.format(Number(order.delivery_fee))}</strong></div>
          <div className="summary-divider" />
          <div className="checkout-line total-line"><strong>Total due on delivery</strong><strong>{npr.format(Number(order.total))}</strong></div>
        </section>
        <div className="order-actions"><Link className="primary-link-button" href="/">Continue shopping</Link><Link className="summary-back-link" href="/account">Go to account</Link></div>
      </section>
    </main>
  );
}
