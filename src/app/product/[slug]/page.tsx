import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ProductOffers } from "@/components/customer/product-offers";
import { CartBadge } from "@/components/customer/cart-badge";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Product = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  unit: string;
  categories: { name: string; slug: string } | null;
};

async function getProduct(slug: string): Promise<Product | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, description, brand, model, unit, categories(name, slug)")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Could not load product:", error.message);
    return null;
  }
  return (data as Product | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Hardware product" };

  const description = product.description || `Find ${product.name} from nearby hardware shops in Nepal.`;
  return {
    title: product.name,
    description,
    openGraph: { title: product.name, description, type: "website" },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  return (
    <main className="product-page">
      <header className="product-page-header">
        <Link className="brand" href="/" aria-label="Hardware Online Pasal home">
          <span className="brand-mark" aria-hidden="true">H</span>
          <span className="brand-name">hardware<span>pasal</span></span>
        </Link>
        <div className="compact-actions"><Link className="back-link" href="/account">Account</Link><CartBadge /></div>
      </header>
      <div className="product-breadcrumb"><Link href="/">Home</Link><span>/</span><span>{product.categories?.name || "Hardware"}</span><span>/</span><strong>{product.name}</strong></div>
      <div className="product-detail-layout">
        <section className="product-showcase" aria-label="Product information">
          <div className="detail-art" aria-hidden="true"><span>⌁</span><i /></div>
          <div className="product-details">
            <p className="section-kicker">{product.categories?.name || "Hardware"}</p>
            <h1>{product.name}</h1>
            {(product.brand || product.model) && <p className="product-meta">{[product.brand, product.model].filter(Boolean).join(" · ")}</p>}
            <p className="product-unit">Sold by {product.unit}</p>
            {product.description && <p className="product-description">{product.description}</p>}
          </div>
        </section>
        <ProductOffers productId={product.id} productName={product.name} unit={product.unit} />
      </div>
      <footer className="product-page-footer"><span>Prices and availability are provided by independent shops and may change.</span><Link href="/">Hardware Online Pasal</Link></footer>
    </main>
  );
}
