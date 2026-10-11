"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CartBadge } from "@/components/customer/cart-badge";

type Category = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
};

type NearbyProduct = {
  product_id: string;
  vendor_product_id: string;
  product_name: string;
  vendor_name: string;
  price: number;
  available_stock: number;
  in_stock: boolean;
  distance_meters: number;
  estimated_delivery_minutes: number;
};

const npr = new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 });

export function CategoryBrowser({
  path,
  category,
  subcategories,
}: {
  path: Category[];
  category: Category;
  subcategories: Category[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState(category.name);
  const [products, setProducts] = useState<NearbyProduct[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSearched(true);
    setProducts([]);
    if (!navigator.geolocation) {
      setMessage("Location is not available in this browser. Try a newer browser or device.");
      return;
    }

    setLoading(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc("search_nearby_products", {
          p_query: query.trim() || null,
          p_latitude: coords.latitude,
          p_longitude: coords.longitude,
          p_radius_meters: 10000,
          p_limit: 30,
        });
        if (error) throw error;
        const results = (data ?? []) as NearbyProduct[];
        setProducts(results);
        if (results.length === 0) setMessage("No nearby shop has this category in stock. Try a subcategory or a different search.");
      } catch (error) {
        console.error("Category product search failed:", error);
        setMessage("Nearby products could not be loaded. Please try again.");
      } finally {
        setLoading(false);
      }
    }, (error) => {
      setLoading(false);
      setMessage(error.code === error.PERMISSION_DENIED
        ? "Location permission is needed to find nearby hardware shops. Allow it in your browser settings and try again."
        : "We could not get your location. Please try again.");
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }

  async function openProduct(productId: string) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from("products").select("slug").eq("id", productId).maybeSingle();
      if (error || !data?.slug) throw error ?? new Error("Product URL is unavailable.");
      router.push(`/product/${data.slug}`);
    } catch (error) {
      console.error("Could not open product details:", error);
      setMessage("We could not open that product. Please try again.");
    }
  }

  return (
    <main className="category-page">
      <header className="product-page-header">
        <Link className="brand" href="/" aria-label="Hardware Online Pasal home">
          <span className="brand-mark" aria-hidden="true">H</span>
          <span className="brand-name">hardware<span>pasal</span></span>
        </Link>
        <div className="compact-actions"><Link className="back-link" href="/account">Account</Link><CartBadge /></div>
      </header>
      <nav className="product-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>{path.map((item, index) => (
          <span className="breadcrumb-item" key={item.id}>
            <span>/</span>
            {index === path.length - 1 ? <strong>{item.name}</strong> : <Link href={`/hardware/${path.slice(0, index + 1).map((part) => part.slug).join("/")}`}>{item.name}</Link>}
          </span>
        ))}
      </nav>

      <section className="category-hero">
        <p className="section-kicker">Hardware for your next project</p>
        <h1>{category.name}</h1>
        <p>Find local stock from independent hardware shops near you.</p>
        <form className="search-form category-search" onSubmit={search}>
          <span className="search-icon" aria-hidden="true">⌕</span>
          <label className="sr-only" htmlFor="category-search">Search this category</label>
          <input id="category-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${category.name.toLowerCase()}`} />
          <button type="submit" disabled={loading}>{loading ? "Searching…" : "Find nearby"}</button>
        </form>
        {message && <p className="status-message" role="status">{message}</p>}
      </section>

      {subcategories.length > 0 && (
        <section className="category-children">
          <div className="section-heading"><div><p className="section-kicker">Browse by type</p><h2>Popular subcategories</h2></div></div>
          <div className="category-grid">
            {subcategories.map((child, index) => (
              <Link className="category-card" key={child.id} href={`/hardware/${[...path.map((item) => item.slug), child.slug].join("/")}`}>
                <span className={`category-art category-art-${index % 5}`} aria-hidden="true">{["⌁", "⌖", "ϟ", "▤", "⊞"][index % 5]}</span>
                <span className="category-name">{child.name}</span>
                <span className="category-arrow" aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="category-results" aria-live="polite">
        <div className="section-heading"><div><p className="section-kicker">Available nearby</p><h2>{hasSearched ? "Nearby matches" : "Find local availability"}</h2></div></div>
        {products.length > 0 ? (
          <div className="product-grid">
            {products.map((product) => (
              <article className="product-card" key={product.vendor_product_id}>
                <div className="product-card-top"><span className={`stock-tag ${product.in_stock ? "in-stock" : "out-stock"}`}><i />{product.in_stock ? `${product.available_stock} in stock` : "Out of stock"}</span><span className="product-visual" aria-hidden="true">⌁</span></div>
                <div className="product-card-body">
                  <button className="product-title-button" type="button" onClick={() => void openProduct(product.product_id)}>{product.product_name}</button>
                  <p className="vendor-line">{product.vendor_name} <span>·</span> {product.distance_meters < 1000 ? `${Math.round(product.distance_meters)} m` : `${(product.distance_meters / 1000).toFixed(1)} km`} away</p>
                  <div className="product-card-bottom"><strong>{npr.format(product.price)}</strong><span>~{product.estimated_delivery_minutes} min</span></div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="nearby-placeholder"><div className="placeholder-icon" aria-hidden="true">⌕</div><div><strong>{hasSearched ? "No matches yet" : "Use your location to compare shops"}</strong><p>{hasSearched ? message : "We’ll check active shop inventory within its delivery area and show you nearby options."}</p></div></div>
        )}
      </section>
      <footer className="product-page-footer"><span>Prices and stock are provided by independent hardware shops.</span><Link href="/">Hardware Online Pasal</Link></footer>
    </main>
  );
}
