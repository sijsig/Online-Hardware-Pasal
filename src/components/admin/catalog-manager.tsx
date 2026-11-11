"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Category = { id: string; parent_id: string | null; name: string; slug: string; is_active: boolean };
type Product = { id: string; category_id: string | null; name: string; slug: string; brand: string | null; model: string | null; unit: string; is_active: boolean };

function slugify(value: string) {
  return value.toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 110);
}

export function CatalogManager({ categories, products }: { categories: Category[]; products: Product[] }) {
  const router = useRouter();
  const [categoryName, setCategoryName] = useState("");
  const [parentId, setParentId] = useState("");
  const [productName, setProductName] = useState("");
  const [productCategoryId, setProductCategoryId] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [unit, setUnit] = useState("each");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = categoryName.trim();
    const slug = slugify(name);
    if (!slug) { setMessage("Use a category name with English letters or numbers to create its URL."); return; }
    setSaving(true); setMessage("");
    try {
      const { error } = await createClient().from("categories").insert({ name, slug, parent_id: parentId || null, sort_order: categories.length * 10 });
      if (error) throw error;
      setCategoryName(""); setParentId(""); setMessage("Category added."); router.refresh();
    } catch (error) {
      console.error("Category creation failed:", error);
      setMessage("Could not add the category. Its URL may already be in use.");
    } finally { setSaving(false); }
  }

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = productName.trim();
    const slug = slugify(name);
    if (!slug) { setMessage("Use a product name with English letters or numbers to create its URL."); return; }
    setSaving(true); setMessage("");
    try {
      const { error } = await createClient().from("products").insert({ name, slug, category_id: productCategoryId || null, brand: brand.trim() || null, model: model.trim() || null, unit: unit.trim() || "each" });
      if (error) throw error;
      setProductName(""); setBrand(""); setModel(""); setMessage("Catalog product added."); router.refresh();
    } catch (error) {
      console.error("Catalog product creation failed:", error);
      setMessage("Could not add the product. Its URL may already be in use.");
    } finally { setSaving(false); }
  }

  async function setActive(table: "categories" | "products", id: string, isActive: boolean) {
    setSaving(true); setMessage("");
    try {
      const { error } = await createClient().from(table).update({ is_active: isActive }).eq("id", id);
      if (error) throw error;
      setMessage(isActive ? "Item is now visible." : "Item is now hidden."); router.refresh();
    } catch (error) {
      console.error("Catalog visibility update failed:", error);
      setMessage("Could not update visibility. Please try again.");
    } finally { setSaving(false); }
  }

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  return <section className="admin-rider-section" id="catalog">
    <div className="admin-page-title"><div><p className="section-kicker">Catalog</p><h2>Categories & products</h2><p>Manage the shared catalog. Vendors add their own price and stock separately.</p></div></div>
    <div className="admin-catalog-forms">
      <form className="admin-catalog-form" onSubmit={addCategory}><h3>Add category</h3><label>Name<input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required minLength={2} maxLength={100} /></label><label>Parent category<select value={parentId} onChange={(event) => setParentId(event.target.value)}><option value="">Top level</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><button disabled={saving}>{saving ? "Saving…" : "Add category"}</button></form>
      <form className="admin-catalog-form" onSubmit={addProduct}><h3>Add catalog product</h3><label>Product name<input value={productName} onChange={(event) => setProductName(event.target.value)} required minLength={2} maxLength={160} /></label><label>Category<select value={productCategoryId} onChange={(event) => setProductCategoryId(event.target.value)}><option value="">No category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><div className="admin-catalog-inline"><label>Brand<input value={brand} onChange={(event) => setBrand(event.target.value)} maxLength={100} /></label><label>Model<input value={model} onChange={(event) => setModel(event.target.value)} maxLength={100} /></label></div><label>Unit<input value={unit} onChange={(event) => setUnit(event.target.value)} required maxLength={32} placeholder="each, meter, bag" /></label><button disabled={saving}>{saving ? "Saving…" : "Add product"}</button></form>
    </div>
    {message ? <p className="admin-catalog-message" role="status">{message}</p> : null}
    <div className="admin-catalog-columns">
      <section><h3>Categories ({categories.length})</h3><div className="admin-catalog-list">{categories.map((category) => <article key={category.id}><div><strong>{category.name}</strong><span>{category.parent_id ? `Under ${categoryNames.get(category.parent_id) || "category"}` : "Top level"} · /hardware/{category.slug}</span></div><button type="button" disabled={saving} onClick={() => void setActive("categories", category.id, !category.is_active)}>{category.is_active ? "Hide" : "Show"}</button></article>)}</div></section>
      <section><h3>Recent catalog products ({products.length})</h3><div className="admin-catalog-list">{products.map((product) => <article key={product.id}><div><strong>{product.name}</strong><span>{[product.brand, product.model, categoryNames.get(product.category_id ?? ""), product.unit].filter(Boolean).join(" · ")} · /product/{product.slug}</span></div><button type="button" disabled={saving} onClick={() => void setActive("products", product.id, !product.is_active)}>{product.is_active ? "Hide" : "Show"}</button></article>)}</div></section>
    </div>
  </section>;
}
