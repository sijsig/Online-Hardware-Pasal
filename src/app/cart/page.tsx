"use client";

import Link from "next/link";
import { useCart } from "@/components/customer/cart-provider";

const npr = new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 });

export default function CartPage() {
  const { items, ready, vendorName, subtotal, setQuantity, removeItem, clearCart } = useCart();

  return (
    <main className="simple-page">
      <header className="product-page-header">
        <Link className="brand" href="/"><span className="brand-mark">H</span><span className="brand-name">hardware<span>pasal</span></span></Link>
        <Link className="back-link" href="/">Continue shopping</Link>
      </header>
      <section className="cart-content">
        <p className="section-kicker">Your order</p>
        <h1>Your cart</h1>
        {!ready ? <div className="empty-cart"><p>Loading your cart…</p></div> : items.length === 0 ? (
          <div className="empty-cart">
            <span className="empty-symbol" aria-hidden="true">▢</span>
            <h2>Your cart is empty</h2>
            <p>Search nearby hardware shops and add items from one shop to get started.</p>
            <Link className="primary-link-button" href="/">Find hardware near me</Link>
          </div>
        ) : (
          <div className="cart-layout">
            <section className="cart-items-panel">
              <div className="cart-shop-heading"><div className="offer-shop-icon" aria-hidden="true">⌂</div><div><small>One shop per order</small><strong>{vendorName}</strong></div><button type="button" onClick={clearCart}>Clear cart</button></div>
              {items.map((item) => (
                <article className="cart-line" key={item.vendorProductId}>
                  <div className="product-visual" aria-hidden="true">⌁</div>
                  <div className="cart-line-info"><strong>{item.productName}</strong><span>{npr.format(item.price)} / {item.unit}</span><button type="button" onClick={() => removeItem(item.vendorProductId)}>Remove</button></div>
                  <div className="quantity-control"><button type="button" aria-label={`Decrease ${item.productName}`} onClick={() => setQuantity(item.vendorProductId, item.quantity - 1)}>−</button><span>{item.quantity}</span><button type="button" aria-label={`Increase ${item.productName}`} disabled={item.quantity >= item.availableStock} onClick={() => setQuantity(item.vendorProductId, item.quantity + 1)}>+</button></div>
                  <strong className="cart-line-total">{npr.format(item.price * item.quantity)}</strong>
                </article>
              ))}
            </section>
            <aside className="cart-summary">
              <h2>Order summary</h2>
              <div><span>Items subtotal</span><strong>{npr.format(subtotal)}</strong></div>
              <div><span>Delivery fee</span><span>Confirmed at checkout</span></div>
              <p>Prices and stock are checked again when you place the order.</p>
              <Link className="primary-link-button" href="/checkout">Continue to checkout <span>→</span></Link>
              <Link className="summary-back-link" href="/">Keep shopping</Link>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
