"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CatalogProduct = { id: string; name: string; brand: string | null; unit: string };
type VendorCategory = { id: string; name: string; parent_id: string | null };
type ProductSubmission = { id: string; product_id: string | null; product_name: string; price: number | string; stock_quantity: number; status: "pending" | "approved" | "rejected"; admin_note: string | null; created_at: string };
type InventoryItem = {
  id: string;
  product_id: string;
  product_name: string;
  brand: string | null;
  unit: string;
  vendor_sku: string | null;
  price: number | string;
  stock_quantity: number;
  reserved_quantity: number;
  is_active: boolean;
  approval_status: "pending" | "approved" | "rejected";
  updated_at: string;
};

function inventoryError(message: string) {
  const normalized = message.toLowerCase();
  if (message.includes("42501") || normalized.includes("not allowed")) return "Your account cannot manage this shop’s inventory.";
  if (normalized.includes("reserved")) return "Stock cannot be reduced below the quantity reserved for current orders.";
  if (normalized.includes("valid product price") || normalized.includes("valid stock quantity")) return "Enter a valid positive price and a whole-number stock quantity.";
  if (normalized.includes("unavailable")) return "This catalog product is unavailable. Refresh and try another product.";
  return "We could not save this inventory item. Check the values and try again.";
}

function InventoryRow({ item, vendorId, canManage, commissionRate }: { item: InventoryItem; vendorId: string; canManage: boolean; commissionRate: number }) {
  const router = useRouter();
  const [price, setPrice] = useState(String(item.price));
  const [stock, setStock] = useState(String(item.stock_quantity));
  const [sku, setSku] = useState(item.vendor_sku ?? "");
  const [isActive, setIsActive] = useState(item.is_active);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const commission = Number(item.price) * commissionRate;
  const canEdit = canManage && item.approval_status === "approved";

  async function save() {
    const priceValue = Number(price);
    const stockValue = Number(stock);
    if (!Number.isFinite(priceValue) || priceValue <= 0 || !Number.isInteger(stockValue) || stockValue < 0) {
      setMessage("Enter a price above Rs. 0 and stock as a whole number of 0 or more.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const { error } = await createClient().rpc("vendor_upsert_inventory", {
        p_vendor_id: vendorId,
        p_product_id: item.product_id,
        p_price: priceValue,
        p_stock_quantity: stockValue,
        p_is_active: isActive,
        p_vendor_sku: sku.trim() || null,
      });
      if (error) throw error;
      setMessage("Saved.");
      router.refresh();
    } catch (error) {
      console.error("Could not save vendor inventory:", error);
      setMessage(error instanceof Error ? inventoryError(error.message) : "Could not save this item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="inventory-row">
      <div className="inventory-product-heading"><div><strong>{item.product_name}</strong><small>{[item.brand, `Sold by ${item.unit}`].filter(Boolean).join(" · ")}</small></div><span className={`inventory-availability ${item.approval_status === "approved" && item.is_active ? "is-enabled" : ""}`}>{item.approval_status === "pending" ? "Pending approval" : item.approval_status === "rejected" ? "Rejected" : item.is_active ? "Listed" : "Hidden"}</span></div>
      <p className="vendor-commission-breakdown">Per unit: customer price <strong>Rs. {Number(item.price).toLocaleString("en-NP", { maximumFractionDigits: 2 })}</strong> · platform commission ({(commissionRate * 100).toFixed(1)}%) <strong>Rs. {commission.toLocaleString("en-NP", { maximumFractionDigits: 2 })}</strong> · estimated shop amount <strong>Rs. {(Number(item.price) - commission).toLocaleString("en-NP", { maximumFractionDigits: 2 })}</strong></p>
      <div className="inventory-fields">
        <label>Price (NPR)<input aria-label={`${item.product_name} price`} type="number" min="0.01" step="0.01" inputMode="decimal" value={price} disabled={!canEdit || saving} onChange={(event) => setPrice(event.target.value)} /></label>
        <label>Physical stock<input aria-label={`${item.product_name} physical stock`} type="number" min="0" step="1" inputMode="numeric" value={stock} disabled={!canEdit || saving} onChange={(event) => setStock(event.target.value)} /></label>
        <label>Shop SKU <input aria-label={`${item.product_name} shop SKU`} maxLength={100} value={sku} disabled={!canEdit || saving} onChange={(event) => setSku(event.target.value)} placeholder="Optional" /></label>
      </div>
      <div className="inventory-row-footer">
        <span className="inventory-stock-note">{item.reserved_quantity} reserved · {Math.max(0, item.stock_quantity - item.reserved_quantity)} available</span>
        {canEdit ? <label className="inventory-toggle"><input type="checkbox" checked={isActive} disabled={saving} onChange={(event) => setIsActive(event.target.checked)} /> Available to customers</label> : item.approval_status === "pending" ? <span className="inventory-toggle">Admin review required before listing</span> : <span className="inventory-toggle">Read only</span>}
        {canEdit && <button className="vendor-primary-button" type="button" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save changes"}</button>}
      </div>
      {message && <p className={`inventory-row-message${message === "Saved." ? " is-success" : ""}`} role="status">{message}</p>}
    </article>
  );
}

export function VendorInventory({
  vendorId,
  inventory,
  submissions,
  categories,
  commissionRate,
  canManage,
  page,
  totalPages,
}: {
  vendorId: string;
  inventory: InventoryItem[];
  submissions: ProductSubmission[];
  categories: VendorCategory[];
  commissionRate: number;
  canManage: boolean;
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CatalogProduct[]>([]);
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [selectedSku, setSelectedSku] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newUnit, setNewUnit] = useState("each");
  const [newPrice, setNewPrice] = useState("");
  const [newStock, setNewStock] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const knownProductIds = useMemo(() => new Set(inventory.map((item) => item.product_id)), [inventory]);

  useEffect(() => {
    const query = search.trim();
    if (!canManage || query.length < 2) return;
    let current = true;
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      const safeQuery = query.replace(/[%_]/g, " ");
      const { data, error } = await createClient()
        .from("products")
        .select("id, name, brand, unit")
        .eq("is_active", true)
        .ilike("name", `%${safeQuery}%`)
        .order("name")
        .limit(10);
      if (!current) return;
      if (error) {
        console.error("Catalog product search failed:", error.message);
        setMessage("Product search is temporarily unavailable. Try again in a moment.");
        setResults([]);
      } else {
        setResults((data ?? []) as CatalogProduct[]);
        setMessage("");
      }
      setSearching(false);
    }, 250);
    return () => { current = false; window.clearTimeout(timeout); };
  }, [canManage, search]);

  function chooseCatalogProduct(product: CatalogProduct) {
    setMessage("");
    setSelected(product);
    setPrice("");
    setStock("");
    setSelectedSku("");
  }

  async function addOrUpdateListing() {
    if (!selected) return;
    const priceValue = Number(price);
    const stockValue = Number(stock);
    if (!Number.isFinite(priceValue) || priceValue <= 0 || !Number.isInteger(stockValue) || stockValue < 0) {
      setMessage("Enter a price above Rs. 0 and stock as a whole number of 0 or more.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const { error } = await createClient().rpc("submit_vendor_product", {
        p_vendor_id: vendorId,
        p_product_id: selected.id,
        p_product_name: null,
        p_category_id: null,
        p_brand: null,
        p_model: null,
        p_unit: selected.unit,
        p_price: priceValue,
        p_stock_quantity: stockValue,
        p_vendor_sku: selectedSku.trim() || null,
      });
      if (error) throw error;
      setSelected(null);
      setSearch("");
      setPrice("");
      setStock("");
      setSelectedSku("");
      setMessage(`${selected.name} was submitted for admin approval. It will appear in the marketplace after approval.`);
      router.refresh();
    } catch (error) {
      console.error("Could not list catalog product:", error);
      setMessage(error instanceof Error ? inventoryError(error.message) : "Could not add this product to your shop.");
    } finally {
      setSaving(false);
    }
  }

  async function submitNewProduct() {
    const priceValue = Number(newPrice);
    const stockValue = Number(newStock);
    if (newName.trim().length < 2 || !newCategoryId || !Number.isFinite(priceValue) || priceValue <= 0 || !Number.isInteger(stockValue) || stockValue < 0) {
      setMessage("Enter a product name, category, price above Rs. 0, and a whole-number stock quantity.");
      return;
    }
    setSaving(true); setMessage("");
    try {
      const { error } = await createClient().rpc("submit_vendor_product", {
        p_vendor_id: vendorId,
        p_product_id: null,
        p_product_name: newName.trim(),
        p_category_id: newCategoryId,
        p_brand: newBrand.trim() || null,
        p_model: newModel.trim() || null,
        p_unit: newUnit.trim() || "each",
        p_price: priceValue,
        p_stock_quantity: stockValue,
        p_vendor_sku: null,
      });
      if (error) throw error;
      setNewName(""); setNewCategoryId(""); setNewBrand(""); setNewModel(""); setNewUnit("each"); setNewPrice(""); setNewStock("");
      setMessage("Product submitted for admin approval. It will appear in the marketplace after approval.");
      router.refresh();
    } catch (error) {
      console.error("Could not submit new vendor product:", error);
      setMessage(error instanceof Error ? inventoryError(error.message) : "Could not submit this product for review.");
    } finally { setSaving(false); }
  }

  return (
    <section className="vendor-inventory-section" id="inventory">
      <div className="vendor-inventory-heading"><div><p className="section-kicker">Shop catalog</p><h2>Inventory and pricing</h2><p>New products appear to customers after admin approval. Price changes on approved listings take effect immediately.</p></div><span>{inventory.length} shown</span></div>

      {canManage && (
        <div className="inventory-add-panel">
          <h3>List a product for your shop</h3>
          <label className="inventory-search-label">Search product catalog<input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setSelected(null); }} placeholder="Try ‘drill’, ‘pipe’, or ‘screw’" maxLength={80} /></label>
          {search.trim().length >= 2 && <div className="inventory-search-results" aria-live="polite">
            {searching ? <p>Searching catalog…</p> : results.filter((product) => !knownProductIds.has(product.id)).length ? results.filter((product) => !knownProductIds.has(product.id)).map((product) => <button type="button" key={product.id} onClick={() => chooseCatalogProduct(product)}>{product.name}{product.brand ? ` · ${product.brand}` : ""}<small>Sold by {product.unit}</small></button>) : <p>No matching active catalog products found. You can submit a new product below.</p>}
          </div>}
          {selected && <div className="inventory-add-form"><strong>{selected.name}</strong><div className="inventory-fields"><label>Price (NPR)<input type="number" min="0.01" step="0.01" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="e.g. 750" /></label><label>Physical stock<input type="number" min="0" step="1" inputMode="numeric" value={stock} onChange={(event) => setStock(event.target.value)} placeholder="e.g. 12" /></label><label>Shop SKU<input maxLength={100} value={selectedSku} onChange={(event) => setSelectedSku(event.target.value)} placeholder="Optional" /></label></div><CommissionBreakdown price={price} commissionRate={commissionRate} /><button className="vendor-primary-button" type="button" disabled={saving} onClick={() => void addOrUpdateListing()}>{saving ? "Submitting…" : "Submit for admin approval"}</button></div>}
          <div className="vendor-new-product-form"><h4>Product not in the catalog?</h4><div className="vendor-application-grid"><label>Product name<input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={160} placeholder="e.g. 20mm PVC elbow" /></label><label>Category<select value={newCategoryId} onChange={(event) => setNewCategoryId(event.target.value)}><option value="">Choose a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Brand <span>Optional</span><input value={newBrand} onChange={(event) => setNewBrand(event.target.value)} maxLength={100} /></label><label>Model <span>Optional</span><input value={newModel} onChange={(event) => setNewModel(event.target.value)} maxLength={100} /></label><label>Sold by<input value={newUnit} onChange={(event) => setNewUnit(event.target.value)} maxLength={32} placeholder="each, meter, bag" /></label><label>Price (NPR)<input type="number" min="0.01" step="0.01" value={newPrice} onChange={(event) => setNewPrice(event.target.value)} /></label><label>Physical stock<input type="number" min="0" step="1" value={newStock} onChange={(event) => setNewStock(event.target.value)} /></label></div><CommissionBreakdown price={newPrice} commissionRate={commissionRate} /><button className="vendor-primary-button" type="button" disabled={saving} onClick={() => void submitNewProduct()}>{saving ? "Submitting…" : "Submit new product for approval"}</button></div>
          {message && <p className="inventory-row-message" role="status">{message}</p>}
        </div>
      )}

      {submissions.length > 0 && <section className="vendor-submissions"><h3>Product approval requests</h3>{submissions.map((submission) => <article key={submission.id}><div><strong>{submission.product_name}</strong><span>Rs. {Number(submission.price).toLocaleString("en-NP")} · {submission.stock_quantity} in stock · {new Date(submission.created_at).toLocaleDateString("en-NP", { dateStyle: "medium" })}</span>{submission.admin_note && <small>Admin note: {submission.admin_note}</small>}</div><span className={`vendor-approval-status approval-${submission.status}`}>{submission.status}</span></article>)}</section>}
      {inventory.length ? <div className="inventory-list">{inventory.map((item) => <InventoryRow key={`${item.id}-${item.updated_at}`} item={item} vendorId={vendorId} canManage={canManage} commissionRate={commissionRate} />)}</div> : <div className="vendor-orders-empty"><span aria-hidden="true">▤</span><h3>No approved inventory yet</h3><p>Submit products above. Approved listings will be visible to customers near your shop.</p></div>}

      {totalPages > 1 && <nav className="inventory-pagination" aria-label="Inventory pages"><span>Page {page} of {totalPages}</span><div>{page > 1 && <Link href={`/vendor?shop=${vendorId}&page=${page - 1}#inventory`}>Previous</Link>}{page < totalPages && <Link href={`/vendor?shop=${vendorId}&page=${page + 1}#inventory`}>Next</Link>}</div></nav>}
    </section>
  );
}

function CommissionBreakdown({ price, commissionRate }: { price: string; commissionRate: number }) {
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) return <p className="vendor-commission-breakdown">Commission estimate appears here after you enter a price.</p>;
  const commission = Math.round(amount * commissionRate * 100) / 100;
  return <p className="vendor-commission-breakdown">Estimated per unit: customer price <strong>Rs. {amount.toLocaleString("en-NP", { maximumFractionDigits: 2 })}</strong> · platform commission ({(commissionRate * 100).toFixed(1)}%) <strong>Rs. {commission.toLocaleString("en-NP", { maximumFractionDigits: 2 })}</strong> · estimated shop amount <strong>Rs. {(amount - commission).toLocaleString("en-NP", { maximumFractionDigits: 2 })}</strong>. Final commission is based on the completed order subtotal.</p>;
}
