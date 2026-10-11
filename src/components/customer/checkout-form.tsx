"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CartItem, useCart } from "@/components/customer/cart-provider";
import { createClient } from "@/lib/supabase/client";

type Address = {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  address_line: string;
  city: string;
  district: string | null;
  province: string | null;
  is_default: boolean;
};

const npr = new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 });

export function CheckoutForm({ initialAddresses }: { initialAddresses: Address[] }) {
  const router = useRouter();
  const { items, ready, vendorId, vendorName, subtotal, clearCart, updateItemDetails } = useCart();
  const [addresses, setAddresses] = useState(initialAddresses);
  const [selectedAddressId, setSelectedAddressId] = useState(initialAddresses.find((item) => item.is_default)?.id ?? initialAddresses[0]?.id ?? "");
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(initialAddresses.length === 0);
  const [savingAddress, setSavingAddress] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [message, setMessage] = useState("");
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [addressDraft, setAddressDraft] = useState({ label: "Home", recipientName: "", phone: "", addressLine: "", city: "", district: "", province: "" });

  useEffect(() => {
    if (!vendorId) return;
    let active = true;
    void createClient().from("vendors").select("base_delivery_fee").eq("id", vendorId).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      if (error || !data) {
        setMessage("The selected shop is unavailable. Please return to your cart and choose another shop.");
        return;
      }
      setDeliveryFee(Number(data.base_delivery_fee));
    });
    return () => { active = false; };
  }, [vendorId]);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage("Location is not available in this browser. Enter your address and try a newer browser or device.");
      return;
    }
    setMessage("");
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setCoordinates({ latitude: coords.latitude, longitude: coords.longitude });
      setMessage("Map location saved for this address.");
    }, (error) => {
      setMessage(error.code === error.PERMISSION_DENIED
        ? "Location permission is needed to set a delivery point. Allow it in your browser settings and try again."
        : "We could not get your location. Please try again.");
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }

  async function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!coordinates) {
      setMessage("Set the map location before saving this delivery address.");
      return;
    }
    setSavingAddress(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { data: id, error } = await supabase.rpc("create_customer_address", {
        p_label: addressDraft.label,
        p_recipient_name: addressDraft.recipientName,
        p_phone: addressDraft.phone,
        p_address_line: addressDraft.addressLine,
        p_city: addressDraft.city,
        p_district: addressDraft.district || null,
        p_province: addressDraft.province || null,
        p_latitude: coordinates.latitude,
        p_longitude: coordinates.longitude,
        p_is_default: addresses.length === 0,
      });
      if (error || !id) throw error ?? new Error("Address was not saved.");
      const { data: saved, error: readError } = await supabase
        .from("addresses")
        .select("id, label, recipient_name, phone, address_line, city, district, province, is_default")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (readError) throw readError;
      setAddresses((saved ?? []) as Address[]);
      setSelectedAddressId(id);
      setShowAddressForm(false);
      setCoordinates(null);
      setAddressDraft({ label: "Home", recipientName: "", phone: "", addressLine: "", city: "", district: "", province: "" });
      setMessage("Delivery address saved.");
    } catch (error) {
      console.error("Could not save delivery address:", error);
      setMessage("We could not save that address. Check the details and try again.");
    } finally {
      setSavingAddress(false);
    }
  }

  async function submitOrder() {
    if (!vendorId || !selectedAddressId || items.length === 0) return;
    setPlacingOrder(true);
    setMessage("");
    try {
      const supabase = createClient();
      const itemIds = items.map((item) => item.vendorProductId);
      const [{ data: inventory, error: inventoryError }, { data: vendor, error: vendorError }] = await Promise.all([
        supabase.from("vendor_products").select("id, price, stock_quantity, reserved_quantity, is_active").in("id", itemIds).eq("vendor_id", vendorId),
        supabase.from("vendors").select("status, base_delivery_fee").eq("id", vendorId).maybeSingle(),
      ]);
      if (inventoryError || vendorError || !vendor || vendor.status !== "active") {
        throw new Error("The selected shop is unavailable. Please return to your cart.");
      }
      const inventoryById = new Map((inventory ?? []).map((row) => [row.id, row]));
      if (inventoryById.size !== items.length) throw new Error("An item in your cart is no longer available. Please refresh your cart.");

      let priceChanged = false;
      for (const item of items) {
        const row = inventoryById.get(item.vendorProductId);
        const price = Number(row?.price);
        const stock = Number(row?.stock_quantity) - Number(row?.reserved_quantity);
        if (!row?.is_active || stock < item.quantity) throw new Error(`${item.productName} no longer has enough stock. Please update your cart.`);
        if (price !== item.price) priceChanged = true;
        updateItemDetails(item.vendorProductId, price, stock);
      }
      if (priceChanged) throw new Error("A product price changed. We updated your cart; please review the new subtotal before placing the order.");

      const currentDeliveryFee = Number(vendor.base_delivery_fee);
      if (deliveryFee !== null && currentDeliveryFee !== deliveryFee) {
        setDeliveryFee(currentDeliveryFee);
        throw new Error("The delivery fee changed. Review the updated total before placing the order.");
      }

      const { data: orderId, error } = await supabase.rpc("create_order", {
        p_vendor_id: vendorId,
        p_address_id: selectedAddressId,
        p_items: items.map((item: CartItem) => ({ vendor_product_id: item.vendorProductId, quantity: item.quantity })),
        p_payment_method: "cash_on_delivery",
      });
      if (error || !orderId) {
        const detail = error?.message || "Order could not be created.";
        if (detail.includes("does not deliver")) throw new Error("This shop cannot deliver to that address. Choose another address or shop.");
        if (detail.includes("stock") || detail.includes("available")) throw new Error("A product is no longer available in that quantity. Please refresh your cart.");
        throw new Error("We could not place your order. Please try again.");
      }

      clearCart();
      router.push(`/orders/${orderId}`);
    } catch (error) {
      console.error("Order placement failed:", error);
      setMessage(error instanceof Error ? error.message : "We could not place your order. Please try again.");
    } finally {
      setPlacingOrder(false);
    }
  }

  if (!ready) return <main className="simple-page"><p className="checkout-loading">Loading your cart…</p></main>;
  if (items.length === 0) return <main className="simple-page"><section className="empty-cart"><h1>Your cart is empty</h1><Link className="primary-link-button" href="/">Find hardware near me</Link></section></main>;

  return (
    <main className="simple-page">
      <header className="product-page-header"><Link className="brand" href="/"><span className="brand-mark">H</span><span className="brand-name">hardware<span>pasal</span></span></Link><Link className="back-link" href="/cart">← Back to cart</Link></header>
      <section className="checkout-content">
        <p className="section-kicker">One shop, one order</p>
        <h1>Checkout</h1>
        <p className="checkout-vendor">Ordering from <strong>{vendorName}</strong></p>
        <div className="checkout-layout">
          <div className="checkout-main">
            <section className="checkout-panel">
              <div className="checkout-panel-heading"><div><small>Step 1</small><h2>Delivery address</h2></div>{addresses.length > 0 && <button type="button" onClick={() => setShowAddressForm(!showAddressForm)}>{showAddressForm ? "Choose saved address" : "+ Add address"}</button>}</div>
              {!showAddressForm && addresses.length > 0 && (
                <div className="saved-addresses">
                  {addresses.map((address) => <label className={`address-option ${selectedAddressId === address.id ? "selected" : ""}`} key={address.id}>
                    <input type="radio" name="delivery-address" value={address.id} checked={selectedAddressId === address.id} onChange={() => setSelectedAddressId(address.id)} />
                    <span><strong>{address.label}{address.is_default ? " · Default" : ""}</strong><small>{address.recipient_name} · {address.phone}</small><small>{address.address_line}, {address.city}{address.district ? `, ${address.district}` : ""}</small></span>
                  </label>)}
                </div>
              )}
              {showAddressForm && <form className="address-editor" onSubmit={saveAddress}>
                <div className="form-grid"><label>Address label<input required maxLength={40} value={addressDraft.label} onChange={(event) => setAddressDraft({ ...addressDraft, label: event.target.value })} placeholder="Home" /></label><label>Recipient name<input required maxLength={120} value={addressDraft.recipientName} onChange={(event) => setAddressDraft({ ...addressDraft, recipientName: event.target.value })} /></label><label>Phone number<input required type="tel" maxLength={30} value={addressDraft.phone} onChange={(event) => setAddressDraft({ ...addressDraft, phone: event.target.value })} placeholder="98XXXXXXXX" /></label><label>City<input required maxLength={100} value={addressDraft.city} onChange={(event) => setAddressDraft({ ...addressDraft, city: event.target.value })} /></label><label className="wide-field">Street address<input required maxLength={300} value={addressDraft.addressLine} onChange={(event) => setAddressDraft({ ...addressDraft, addressLine: event.target.value })} placeholder="Tole, ward, nearby landmark" /></label><label>District (optional)<input maxLength={100} value={addressDraft.district} onChange={(event) => setAddressDraft({ ...addressDraft, district: event.target.value })} /></label><label>Province (optional)<input maxLength={100} value={addressDraft.province} onChange={(event) => setAddressDraft({ ...addressDraft, province: event.target.value })} /></label></div>
                <div className="location-capture"><button className="secondary-button" type="button" onClick={useCurrentLocation}>{coordinates ? "Location captured ✓" : "⌖ Use my current location"}</button><span>{coordinates ? `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}` : "A map point is required to check delivery coverage."}</span></div>
                <button className="save-address-button" type="submit" disabled={savingAddress}>{savingAddress ? "Saving address…" : "Save delivery address"}</button>
              </form>}
            </section>
            <section className="checkout-panel payment-panel"><div><small>Step 2</small><h2>Payment method</h2></div><div className="payment-choice"><span className="payment-radio" /><div><strong>Cash on delivery</strong><small>Pay the rider when your order arrives.</small></div><b>Available</b></div><p>Online payments will appear here after a payment provider is integrated.</p></section>
            {message && <p className="checkout-message" role="alert">{message}</p>}
            <button className="place-order-button" type="button" onClick={() => void submitOrder()} disabled={placingOrder || !selectedAddressId || deliveryFee === null}>{placingOrder ? "Placing order…" : "Place order · Cash on delivery"}</button>
          </div>
          <aside className="checkout-summary"><h2>Order summary</h2><p className="summary-shop">{vendorName}</p>{items.map((item) => <div className="checkout-line" key={item.vendorProductId}><span>{item.productName} × {item.quantity}</span><strong>{npr.format(item.price * item.quantity)}</strong></div>)}<div className="summary-divider" /><div className="checkout-line"><span>Items subtotal</span><strong>{npr.format(subtotal)}</strong></div><div className="checkout-line"><span>Delivery fee</span><strong>{deliveryFee === null ? "Checking…" : deliveryFee === 0 ? "Free" : npr.format(deliveryFee)}</strong></div><div className="summary-divider" /><div className="checkout-line total-line"><strong>Estimated total</strong><strong>{deliveryFee === null ? "—" : npr.format(subtotal + deliveryFee)}</strong></div><p>We recheck current prices and stock before the order is created.</p></aside>
        </div>
      </section>
    </main>
  );
}
