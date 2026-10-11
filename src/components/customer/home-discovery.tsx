"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/components/customer/cart-provider";

type Category = { id: string; name: string; slug: string };

type NearbyProduct = {
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

type Coordinates = { latitude: number; longitude: number };

const fallbackCategories: Category[] = [
  { id: "power-tools", name: "Power tools", slug: "power-tools" },
  { id: "paint-supplies", name: "Paint & finishes", slug: "paint-supplies" },
  { id: "plumbing", name: "Plumbing", slug: "plumbing" },
  { id: "safety-gear", name: "Safety gear", slug: "safety-gear" },
  { id: "building-materials", name: "Building materials", slug: "building-materials" },
];

const money = new Intl.NumberFormat("en-NP", {
  style: "currency",
  currency: "NPR",
  maximumFractionDigits: 0,
});

function prettyDistance(meters: number) {
  return meters < 1000
    ? `${Math.round(meters)} m away`
    : `${(meters / 1000).toFixed(1)} km away`;
}

export function HomeDiscovery({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const { count: cartCount } = useCart();
  const visibleCategories = categories.length > 0 ? categories : fallbackCategories;
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationLabel, setLocationLabel] = useState("Choose your location");
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<NearbyProduct[]>([]);
  const [message, setMessage] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  function locateCustomer() {
    if (!navigator.geolocation) {
      setMessage("Location is not available in this browser. Try a newer browser or device.");
      return;
    }

    setLocating(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ latitude: coords.latitude, longitude: coords.longitude });
        setLocationLabel("Using your current location");
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        setMessage(
          error.code === error.PERMISSION_DENIED
            ? "Location permission is needed to find nearby hardware shops. You can allow it in your browser settings and try again."
            : "We could not get your location. Please try again or move to a place with a better signal.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  async function searchProducts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSearched(true);
    setResults([]);

    if (!location) {
      setMessage("Choose your location first to see shops that can deliver to you.");
      return;
    }

    setSearching(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("search_nearby_products", {
        p_query: query.trim() || null,
        p_latitude: location.latitude,
        p_longitude: location.longitude,
        p_radius_meters: 10000,
        p_limit: 30,
      });

      if (error) throw error;

      const products = (data ?? []) as NearbyProduct[];
      setResults(products);
      if (products.length === 0) {
        setMessage("No nearby shop has this product in stock. Try another search or a wider area.");
      }
    } catch (error) {
      console.error("Nearby product search failed:", error);
      setMessage("We could not load nearby products. Please try again in a moment.");
    } finally {
      setSearching(false);
    }
  }

  async function openProduct(productId: string) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("slug")
        .eq("id", productId)
        .maybeSingle();
      if (error || !data?.slug) throw error ?? new Error("Product URL is unavailable.");
      router.push(`/product/${data.slug}`);
    } catch (error) {
      console.error("Could not open product details:", error);
      setMessage("We could not open that product. Please try again.");
    }
  }

  return (
    <main className="marketplace">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Hardware Online Pasal home">
          <span className="brand-mark" aria-hidden="true">H</span>
          <span className="brand-name">hardware<span>pasal</span></span>
        </Link>
        <button className="location-button" onClick={locateCustomer} type="button">
          <span className="location-pin" aria-hidden="true">⌖</span>
          <span className="location-copy">
            <small>Deliver to</small>
            <strong>{locating ? "Finding you…" : locationLabel}</strong>
          </span>
          <span aria-hidden="true" className="chevron">⌄</span>
        </button>
        <nav className="top-actions" aria-label="Main navigation">
          <a href="#categories">Categories</a>
          <a href="#shops">For shops</a>
          <Link className="account-button" href="/account" aria-label="Account">♙</Link>
          <Link className="cart-button" href="/cart"><span aria-hidden="true">▢</span> Cart <b>{cartCount}</b></Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-content">
          <p className="hero-kicker"><span /> Your neighborhood hardware, delivered</p>
          <h1>Find the right stuff.<br /><em>Right around you.</em></h1>
          <p className="hero-description">Compare nearby hardware shops for the stock, price and delivery that work for your project.</p>
          <form className="search-form" onSubmit={searchProducts}>
            <span className="search-icon" aria-hidden="true">⌕</span>
            <label className="sr-only" htmlFor="product-search">Search hardware products</label>
            <input
              id="product-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="What do you need today? Try ‘drill machine’"
            />
            <button type="submit" disabled={searching}>{searching ? "Searching…" : "Find hardware"}</button>
          </form>
          <div className="search-hint"><span>Popular:</span> cement, drill machine, PVC pipe, paint</div>
          {message && <p className="status-message" role="status">{message}</p>}
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="sun-disc" />
          <div className="toolbox toolbox-back"><span>TOOLS</span><i /></div>
          <div className="toolbox toolbox-front"><span>BUILD<br />BETTER</span><i /></div>
          <div className="bolt-shape" />
          <div className="art-label"><span className="art-label-dot" /> Local shops, one search</div>
        </div>
      </section>

      <div className="trust-strip">
        <div><span className="trust-icon">◎</span><span><strong>Shops near you</strong><small>Local stock, real availability</small></span></div>
        <div><span className="trust-icon">↗</span><span><strong>Quick delivery</strong><small>Riders from your neighborhood</small></span></div>
        <div><span className="trust-icon">Rs</span><span><strong>Compare before you buy</strong><small>Choose what works for you</small></span></div>
      </div>

      <section className="content-section" id="categories">
        <div className="section-heading">
          <div><p className="section-kicker">Start your project</p><h2>Shop by category</h2></div>
          <a className="text-link" href="#categories">Explore all <span>→</span></a>
        </div>
        {visibleCategories.length > 0 ? (
          <div className="category-grid">
            {visibleCategories.map((category, index) => (
              <Link className="category-card" key={category.id} href={`/hardware/${category.slug}`}>
                <span className={`category-art category-art-${index % 5}`} aria-hidden="true">{["⌁", "⌖", "ϟ", "▤", "⊞"][index % 5]}</span>
                <span className="category-name">{category.name}</span>
                <span className="category-arrow" aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="catalog-empty">
            <span className="empty-symbol" aria-hidden="true">▦</span>
            <p>We’re getting the hardware categories ready. Check back soon, or search for an item above.</p>
          </div>
        )}
      </section>

      <section className="results-section" id="shops" aria-live="polite">
        <div className="section-heading">
          <div><p className="section-kicker">Made for your neighborhood</p><h2>{hasSearched ? "Nearby matches" : "Popular near you"}</h2></div>
          {location && <span className="radius-chip"><span /> Within 10 km</span>}
        </div>
        {results.length > 0 ? (
          <div className="product-grid">
            {results.map((product) => (
              <article className="product-card" key={product.vendor_product_id}>
                <div className="product-card-top">
                  <span className={`stock-tag ${product.in_stock ? "in-stock" : "out-stock"}`}>
                    <i />{product.in_stock ? `${product.available_stock} in stock` : "Out of stock"}
                  </span>
                  <span className="product-visual" aria-hidden="true">⌁</span>
                </div>
                <div className="product-card-body">
                  <button className="product-title-button" type="button" onClick={() => void openProduct(product.product_id)}>{product.product_name}</button>
                  <p className="vendor-line">{product.vendor_name} <span>·</span> {prettyDistance(product.distance_meters)}</p>
                  <div className="product-card-bottom"><strong>{money.format(product.price)}</strong><span>~{product.estimated_delivery_minutes} min</span></div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="nearby-placeholder">
            <div className="placeholder-icon" aria-hidden="true">⌕</div>
            <div><strong>{hasSearched ? "No matches yet" : "Tell us where you are"}</strong><p>{hasSearched ? (message || "Search a different product to find available shops.") : "Set your location and search to compare live prices and availability from nearby shops."}</p></div>
            {!location && <button type="button" onClick={locateCustomer}>Use my location</button>}
          </div>
        )}
      </section>

      <section className="shop-banner">
        <div className="banner-mark" aria-hidden="true">+</div>
        <div><p className="section-kicker">For independent hardware shops</p><h2>Bring your shop online.</h2><p>Reach customers nearby and manage orders in one simple place.</p></div>
        <a href="/vendor">List your shop <span>→</span></a>
      </section>

      <footer className="footer"><Link className="brand" href="/"><span className="brand-mark">H</span><span className="brand-name">hardware<span>pasal</span></span></Link><span>Built for local projects in Nepal.</span><span>© Hardware Online Pasal</span></footer>
    </main>
  );
}
