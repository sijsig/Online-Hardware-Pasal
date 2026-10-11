"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/components/customer/cart-provider";

type Offer = {
  product_id: string;
  vendor_product_id: string;
  vendor_id: string;
  product_name: string;
  vendor_name: string;
  price: number;
  available_stock: number;
  in_stock: boolean;
  distance_meters: number;
  estimated_delivery_minutes: number;
  category_slug: string | null;
};

function distanceLabel(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

const currency = new Intl.NumberFormat("en-NP", {
  style: "currency",
  currency: "NPR",
  maximumFractionDigits: 0,
});

export function ProductOffers({ productId, productName, unit }: { productId: string; productName: string; unit: string }) {
  const { addItem } = useCart();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [located, setLocated] = useState(false);
  const [message, setMessage] = useState("");
  const [cartMessage, setCartMessage] = useState("");

  function addOffer(offer: Offer) {
    const result = addItem({
      vendorProductId: offer.vendor_product_id,
      productId: offer.product_id,
      vendorId: offer.vendor_id,
      vendorName: offer.vendor_name,
      productName: offer.product_name,
      unit,
      price: offer.price,
      availableStock: offer.available_stock,
    });
    setCartMessage(result || `${offer.product_name} added to your cart.`);
  }

  function findShops() {
    if (!navigator.geolocation) {
      setMessage("Location is not available in this browser. Try a newer browser or device.");
      return;
    }

    setLoading(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      setLocated(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc("search_nearby_products", {
          p_query: productName,
          p_latitude: coords.latitude,
          p_longitude: coords.longitude,
          p_radius_meters: 10000,
          p_limit: 100,
        });
        if (error) throw error;
        const matches = ((data ?? []) as Offer[]).filter((offer) => offer.product_id === productId);
        setOffers(matches);
        if (matches.length === 0) {
          setMessage("No nearby shops list this product right now. Try searching for a similar item.");
        }
      } catch (error) {
        console.error("Could not load vendor offers:", error);
        setMessage("Nearby shop availability could not be loaded. Please try again.");
      } finally {
        setLoading(false);
      }
    }, (error) => {
      setLoading(false);
      setMessage(error.code === error.PERMISSION_DENIED
        ? "Location permission is needed to show nearby shops. Allow it in your browser settings and try again."
        : "We could not get your location. Please try again.");
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }

  return (
    <section className="offers-panel" aria-live="polite">
      <div className="offers-heading">
        <div><p className="section-kicker">Independent local shops</p><h2>Compare nearby shops</h2></div>
        {(!located || offers.length === 0) && <button className="offers-find-button" type="button" disabled={loading} onClick={findShops}>{loading ? "Finding shops…" : located ? "Search again" : "Find shops near me"}</button>}
      </div>
      {message && <p className="offers-message" role="status">{message}</p>}
      {offers.length > 0 ? (
        <div className="offer-list">
          {offers.map((offer) => (
            <article className="offer-row" key={offer.vendor_product_id}>
              <div className="offer-shop-icon" aria-hidden="true">⌂</div>
              <div className="offer-main">
                <strong>{offer.vendor_name}</strong>
                <span>{distanceLabel(offer.distance_meters)} away · about {offer.estimated_delivery_minutes} min</span>
              </div>
              <div className="offer-price">
                <strong>{currency.format(offer.price)}</strong>
                <span className={offer.in_stock ? "offer-stock available" : "offer-stock"}>
                  {offer.in_stock ? `${offer.available_stock} available` : "Out of stock"}
                </span>
                <button className="add-to-cart-button" type="button" disabled={!offer.in_stock} onClick={() => addOffer(offer)}>Add to cart</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        !message && <p className="offers-intro">Share your location to see current price, availability, and delivery time from shops in your area.</p>
      )}
      {cartMessage && <p className="cart-feedback" role="status">{cartMessage}</p>}
    </section>
  );
}
