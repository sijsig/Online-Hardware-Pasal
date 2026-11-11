import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/customer/sign-out-button";
import { VendorOrders } from "@/components/vendor/vendor-orders";
import { VendorInventory } from "@/components/vendor/vendor-inventory";
import { VendorApplicationForm } from "@/components/vendor/vendor-application-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vendor dashboard", robots: { index: false, follow: false } };

type VendorShop = { id: string; name: string; city: string; status: string; owner_id: string | null; commission_rate: number | string | null };
type OrderStatus = "pending" | "confirmed" | "preparing" | "ready_for_pickup" | "picked_up" | "out_for_delivery" | "delivered" | "cancelled" | "rejected";
type VendorOrderItem = { id: string; order_id: string; product_name_snapshot: string; unit_snapshot: string; quantity: number; line_total: number | string };
type CatalogProduct = { id: string; name: string; brand: string | null; unit: string };
type VendorCategory = { id: string; name: string; parent_id: string | null };
type VendorSubmission = { id: string; product_id: string | null; product_name: string; price: number | string; stock_quantity: number; status: "pending" | "approved" | "rejected"; admin_note: string | null; created_at: string };
type VendorInventoryItem = { id: string; vendor_id: string; product_id: string; vendor_sku: string | null; price: number | string; stock_quantity: number; reserved_quantity: number; is_active: boolean; approval_status: "pending" | "approved" | "rejected"; updated_at: string };

export default async function VendorDashboard({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; page?: string }>;
}) {
  const { shop: requestedShopId, page: requestedPage } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fvendor");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) console.error("Could not check vendor dashboard access:", profileError.message);

  if (!profile || !["vendor_owner", "vendor_staff", "admin"].includes(profile.role)) {
    return <VendorAccessPage email={user.email ?? ""} />;
  }

  const [{ data: owned, error: ownedError }, { data: staffMemberships, error: membershipsError }] = await Promise.all([
    supabase.from("vendors").select("id, name, city, status, owner_id").eq("owner_id", user.id),
    supabase.from("vendor_staff").select("vendor_id, staff_role").eq("user_id", user.id).eq("is_active", true),
  ]);
  if (ownedError) console.error("Could not load owned shops:", ownedError.message);
  if (membershipsError) console.error("Could not load vendor memberships:", membershipsError.message);

  const shopIds = [...new Set([...(owned ?? []).map((shop) => shop.id), ...(staffMemberships ?? []).map((membership) => membership.vendor_id)])];
  if (!shopIds.length) return <VendorAccessPage email={user.email ?? ""} />;

  const { data: shops, error: shopsError } = await supabase
    .from("vendors")
    .select("id, name, city, status, owner_id, commission_rate")
    .in("id", shopIds)
    .order("name");
  if (shopsError) console.error("Could not load authorized shops:", shopsError.message);
  const authorizedShops = (shops ?? []) as VendorShop[];
  if (!authorizedShops.length) return <VendorAccessPage email={user.email ?? ""} />;

  const selectedShop = authorizedShops.find((shop) => shop.id === requestedShopId) ?? authorizedShops[0];
  const staffRole = staffMemberships?.find((membership) => membership.vendor_id === selectedShop.id)?.staff_role;
  const canManageOrders = selectedShop.owner_id === user.id || staffRole === "manager" || staffRole === "orders";
  const canManageInventory = selectedShop.owner_id === user.id || staffRole === "manager" || staffRole === "inventory";

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, status, total, created_at, delivery_address_snapshot")
    .eq("vendor_id", selectedShop.id)
    .order("created_at", { ascending: false })
    .limit(25);
  if (ordersError) console.error("Could not load shop orders:", ordersError.message);

  const orderIds = (orders ?? []).map((order) => order.id);
  const { data: items, error: itemsError } = orderIds.length
    ? await supabase.from("order_items").select("id, order_id, product_name_snapshot, unit_snapshot, quantity, line_total").in("order_id", orderIds).order("created_at")
    : { data: [], error: null };
  if (itemsError) console.error("Could not load shop order items:", itemsError.message);

  const pageSize = 30;
  const inventoryPage = Math.max(1, Math.min(500, Number.parseInt(requestedPage ?? "1", 10) || 1));
  const inventoryStart = (inventoryPage - 1) * pageSize;
  const { data: inventoryData, count: inventoryCount, error: inventoryError } = await supabase
    .from("vendor_products")
    .select("id, vendor_id, product_id, vendor_sku, price, stock_quantity, reserved_quantity, is_active, approval_status, updated_at", { count: "exact" })
    .eq("vendor_id", selectedShop.id)
    .order("updated_at", { ascending: false })
    .range(inventoryStart, inventoryStart + pageSize - 1);
  const [{ data: submissionData, error: submissionError }, { data: categoryData, error: categoriesError }] = await Promise.all([
    supabase.from("vendor_product_submissions").select("id, product_id, product_name, price, stock_quantity, status, admin_note, created_at").eq("vendor_id", selectedShop.id).order("created_at", { ascending: false }).limit(30),
    supabase.from("categories").select("id, name, parent_id").eq("is_active", true).order("sort_order").limit(200),
  ]);
  if (inventoryError) console.error("Could not load shop inventory:", inventoryError.message);

  const inventoryRows = (inventoryData ?? []) as VendorInventoryItem[];
  const productIds = [...new Set(inventoryRows.map((item) => item.product_id))];
  const { data: catalogProducts, error: catalogError } = productIds.length
    ? await supabase.from("products").select("id, name, brand, unit").in("id", productIds)
    : { data: [], error: null };
  if (catalogError) console.error("Could not load catalog names for inventory:", catalogError.message);
  const catalogById = new Map<string, CatalogProduct>((catalogProducts ?? []).map((product) => [product.id, product as CatalogProduct]));
  const vendorInventory = inventoryRows.map((item) => {
    const product = catalogById.get(item.product_id);
    return {
      id: item.id,
      product_id: item.product_id,
      product_name: product?.name ?? "Unavailable catalog product",
      brand: product?.brand ?? null,
      unit: product?.unit ?? "each",
      vendor_sku: item.vendor_sku,
      price: item.price,
      stock_quantity: item.stock_quantity,
      reserved_quantity: item.reserved_quantity,
      is_active: item.is_active,
      approval_status: item.approval_status,
      updated_at: item.updated_at,
    };
  });
  const inventoryTotalPages = Math.max(1, Math.ceil((inventoryCount ?? 0) / pageSize));

  const orderItemsByOrder = new Map<string, VendorOrderItem[]>();
  for (const item of (items ?? []) as VendorOrderItem[]) {
    const orderItems = orderItemsByOrder.get(item.order_id) ?? [];
    orderItems.push(item);
    orderItemsByOrder.set(item.order_id, orderItems);
  }

  const vendorOrders = (orders ?? []).map((order) => ({
    id: order.id,
    status: order.status as OrderStatus,
    total: order.total,
    created_at: order.created_at,
    delivery_address_snapshot: order.delivery_address_snapshot as {
      recipient_name?: string; phone?: string; address_line?: string; city?: string; district?: string | null; province?: string | null;
    },
    items: (orderItemsByOrder.get(order.id) ?? []).map((item) => ({
      id: item.id,
      product_name_snapshot: item.product_name_snapshot,
      unit_snapshot: item.unit_snapshot,
      quantity: item.quantity,
      line_total: item.line_total,
    })),
  }));
  const pendingCount = vendorOrders.filter((order) => order.status === "pending").length;
  const activeCount = vendorOrders.filter((order) => ["confirmed", "preparing", "ready_for_pickup"].includes(order.status)).length;

  return (
    <main className="vendor-page">
      <header className="vendor-header">
        <Link className="brand" href="/"><span className="brand-mark">H</span><span className="brand-name">hardware<span>pasal</span></span></Link>
        <div className="vendor-header-actions"><Link href="/account">Customer account</Link><SignOutButton /></div>
      </header>
      <section className="vendor-dashboard-content">
        <div className="vendor-dashboard-title">
          <div><p className="section-kicker">Vendor workspace</p><h1>Shop dashboard</h1><p>Review customer orders and keep them moving.</p></div>
          <span className={`vendor-shop-status shop-${selectedShop.status}`}>{selectedShop.status.replaceAll("_", " ")}</span>
        </div>

        {authorizedShops.length > 1 && (
          <nav className="vendor-shop-switcher" aria-label="Choose shop">
            {authorizedShops.map((shop) => <Link className={shop.id === selectedShop.id ? "selected" : ""} href={`/vendor?shop=${shop.id}`} key={shop.id}>{shop.name}</Link>)}
          </nav>
        )}

        <div className="vendor-shop-summary"><span className="vendor-shop-mark" aria-hidden="true">⌂</span><div><strong>{selectedShop.name}</strong><small>{selectedShop.city}</small></div><span className="vendor-access-label">{canManageOrders ? "Order manager" : "Read only"}</span></div>

        <nav className="vendor-section-nav" aria-label="Dashboard sections"><a href="#orders">Orders</a><a href="#inventory">Inventory</a></nav>

        {selectedShop.status !== "active" && <p className="vendor-pending-note">This shop is {selectedShop.status}. Orders can still be reviewed, but it will not appear as an active shop to customers.</p>}

        <div className="vendor-kpi-grid">
          <article><span>Orders in queue</span><strong>{vendorOrders.length}</strong></article>
          <article><span>Awaiting response</span><strong>{pendingCount}</strong></article>
          <article><span>In progress</span><strong>{activeCount}</strong></article>
        </div>
        {ordersError || itemsError || inventoryError || catalogError || submissionError || categoriesError ? <p className="vendor-page-error" role="alert">Some shop data could not be loaded. Refresh this page to try again.</p> : null}
        <VendorOrders vendorId={selectedShop.id} orders={vendorOrders} canManageOrders={canManageOrders} />
        <VendorInventory vendorId={selectedShop.id} inventory={vendorInventory} submissions={(submissionData ?? []) as VendorSubmission[]} categories={(categoryData ?? []) as VendorCategory[]} commissionRate={Number(selectedShop.commission_rate ?? 0)} canManage={canManageInventory} page={inventoryPage} totalPages={inventoryTotalPages} />
      </section>
    </main>
  );
}

function VendorAccessPage({ email }: { email: string }) {
  return (
    <main className="simple-page">
      <header className="product-page-header"><Link className="brand" href="/"><span className="brand-mark">H</span><span className="brand-name">hardware<span>pasal</span></span></Link><Link className="back-link" href="/account">Your account</Link></header>
      <section className="vendor-application-card"><span className="vendor-application-icon" aria-hidden="true">⌂</span><p className="section-kicker">Vendor workspace</p><h1>Bring your shop online</h1><p>Apply to list your independent hardware shop. The team will review the shop details before customers can discover it.</p><VendorApplicationForm email={email} /></section>
    </main>
  );
}
