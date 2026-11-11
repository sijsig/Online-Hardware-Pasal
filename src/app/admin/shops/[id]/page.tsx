import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { 
  approveShopAction, 
  rejectShopAction, 
  suspendShopAction, 
  activateShopAction 
} from "@/actions/admin/shops";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  return { title: `Shop ${resolvedParams.id} - Admin`, robots: { index: false, follow: false } };
}

type ShopDetail = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address_line: string;
  city: string;
  district: string | null;
  province: string | null;
  description: string | null;
  status: "pending" | "active" | "suspended" | "rejected";
  owner_id: string | null;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  gst_number: string | null;
  pan_number: string | null;
  bank_account: string | null;
  bank_ifsc: string | null;
  suspended_at: string | null;
};

type Owner = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  model: string | null;
  unit: string;
  price: number;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
};

type Order = {
  id: string;
  total: number;
  status: string;
  created_at: string;
};

async function getShopDetail(shopId: string): Promise<ShopDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", shopId)
    .maybeSingle();
  return data as ShopDetail | null;
}

async function getOwner(ownerId: string): Promise<Owner | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, phone, email, created_at")
    .eq("id", ownerId)
    .maybeSingle();
  return data as Owner | null;
}

async function getShopProducts(shopId: string): Promise<Product[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, slug, brand, model, unit, price, stock_quantity, is_active, created_at")
    .eq("vendor_id", shopId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data as Product[]) ?? [];
}

async function getShopOrders(shopId: string): Promise<Order[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, total, status, created_at")
    .eq("vendor_id", shopId)
    .order("created_at", { ascending: false })
    .limit(10);
  return (data as Order[]) ?? [];
}

export default async function ShopDetailPage({ params }: Props) {
  const { id } = await params;
  const [shop, products, orders] = await Promise.all([
    getShopDetail(id),
    getShopProducts(id),
    getShopOrders(id),
  ]);

  if (!shop) notFound();

  const owner = shop.owner_id ? await getOwner(shop.owner_id) : null;

  const statusConfig = {
    pending: { label: "Pending Review", className: "bg-yellow-100 text-yellow-700", icon: "⏳" },
    active: { label: "Active", className: "bg-green-100 text-green-700", icon: "✅" },
    suspended: { label: "Suspended", className: "bg-red-100 text-red-700", icon: "⛔" },
    rejected: { label: "Rejected", className: "bg-gray-100 text-gray-700", icon: "❌" },
  } as const;

  const currentStatus = statusConfig[shop.status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/shops"
            className="text-gray-500 hover:text-gray-700"
            aria-label="Back to shops"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{shop.name}</h1>
            <p className="text-gray-500 mt-0.5">
              ID: <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{shop.id.slice(0, 8).toUpperCase()}</code>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${currentStatus.className}`}>
            <span aria-hidden="true">{currentStatus.icon}</span>
            {currentStatus.label}
          </span>
        </div>
      </div>

      {/* Action Buttons for pending shops */}
      {shop.status === "pending" && (
        <div className="flex flex-wrap gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800 flex-1">
            This shop application is pending review. Verify their details before approving.
          </p>
          <div className="flex gap-2">
            <form action={approveShopAction}>
              <input type="hidden" name="vendorId" value={shop.id} />
              <button type="submit" className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                Approve Shop
              </button>
            </form>
            <form action={rejectShopAction}>
              <input type="hidden" name="vendorId" value={shop.id} />
              <button type="submit" className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                Reject
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Action Buttons for active/suspended shops */}
      {(shop.status === "active" || shop.status === "suspended") && (
        <div className="flex flex-wrap gap-2">
          {shop.status === "active" && (
            <form action={suspendShopAction}>
              <input type="hidden" name="vendorId" value={shop.id} />
              <button
                type="submit"
                className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                onClick={(e) => {
                  if (!confirm("Suspend this shop? They won't receive new orders until reactivated.")) {
                    e.preventDefault();
                  }
                }}
              >
                Suspend Shop
              </button>
            </form>
          )}
          {shop.status === "suspended" && (
            <form action={activateShopAction}>
              <input type="hidden" name="vendorId" value={shop.id} />
              <button type="submit" className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                Reactivate Shop
              </button>
            </form>
          )}
        </div>
      )}

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column - Shop Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact & Location */}
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact & Location</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-sm text-gray-500">Address</dt>
                <dd className="mt-1 text-gray-900">
                  {shop.address_line}
                  <br />
                  {shop.city}, {shop.district}, {shop.province}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Phone</dt>
                <dd className="mt-1 font-medium text-gray-900">{shop.phone || "Not provided"}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Email</dt>
                <dd className="mt-1 font-medium text-gray-900">{shop.email || "Not provided"}</dd>
              </div>
              {shop.gst_number && (
                <div>
                  <dt className="text-sm text-gray-500">GST Number</dt>
                  <dd className="mt-1 font-mono text-sm text-gray-900">{shop.gst_number}</dd>
                </div>
              )}
              {shop.pan_number && (
                <div>
                  <dt className="text-sm text-gray-500">PAN Number</dt>
                  <dd className="mt-1 font-mono text-sm text-gray-900">{shop.pan_number}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Bank Details */}
          {(shop.bank_account || shop.bank_ifsc) && (
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Bank Details (for Payouts)</h2>
              <dl className="grid gap-4 sm:grid-cols-2">
                {shop.bank_account && (
                  <div>
                    <dt className="text-sm text-gray-500">Account Number</dt>
                    <dd className="mt-1 font-mono text-sm text-gray-900">{shop.bank_account}</dd>
                  </div>
                )}
                {shop.bank_ifsc && (
                  <div>
                    <dt className="text-sm text-gray-500">IFSC Code</dt>
                    <dd className="mt-1 font-mono text-sm text-gray-900">{shop.bank_ifsc}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {/* Description */}
          {shop.description && (
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">About the Shop</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{shop.description}</p>
            </section>
          )}

          {/* Products */}
          <section className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Products ({products.length})</h2>
              <Link href={`/admin/products?shop=${shop.id}`} className="text-sm text-orange-600 hover:text-orange-700">
                Manage all
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {products.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">No products listed yet</div>
              ) : (
                products.map((product) => (
                  <div key={product.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xl">
                        🔧
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-500">
                          {product.brand || "No brand"} · {product.model || "No model"} · {product.unit}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">Rs. {Number(product.price).toLocaleString("en-NP")}</p>
                      <p className={`text-sm ${product.stock_quantity < 10 ? "text-red-600" : "text-gray-500"}`}>
                        Stock: {product.stock_quantity}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Recent Orders */}
          <section className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Orders ({orders.length})</h2>
              <Link href={`/admin/orders?shop=${shop.id}`} className="text-sm text-orange-600 hover:text-orange-700">
                View all
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {orders.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">No orders yet</div>
              ) : (
                orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50">
                    <div>
                      <p className="font-mono text-sm text-gray-500">#{order.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(order.created_at).toLocaleString("en-NP", {
                          dateStyle: "short",
                          timeStyle: "short",
                          timeZone: "Asia/Kathmandu",
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">Rs. {Number(order.total).toLocaleString("en-NP")}</p>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          order.status === "delivered"
                            ? "bg-green-100 text-green-700"
                            : order.status === "confirmed"
                            ? "bg-blue-100 text-blue-700"
                            : order.status === "delivering"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right column - Owner & Timeline */}
        <div className="space-y-6">
          {/* Owner Info */}
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Shop Owner</h2>
            {owner ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
                    {owner.full_name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{owner.full_name || "Unknown"}</p>
                    <p className="text-sm text-gray-500">{owner.email || "No email"}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-500">Phone: {owner.phone || "Not provided"}</p>
                  <p className="text-sm text-gray-500">
                    Joined: {new Date(owner.created_at).toLocaleDateString("en-NP", {
                      dateStyle: "medium",
                      timeZone: "Asia/Kathmandu",
                    })}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <p>Owner profile not linked</p>
                <p className="text-sm mt-1">The shop owner hasn't connected their account yet.</p>
              </div>
            )}
          </section>

          {/* Timeline */}
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h2>
            <dl className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-bold">1</div>
                <div>
                  <dt className="text-sm text-gray-500">Application Submitted</dt>
                  <dd className="text-gray-900">
                    {new Date(shop.created_at).toLocaleString("en-NP", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Kathmandu",
                    })}
                  </dd>
                </div>
              </div>
              {shop.approved_at && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs font-bold">2</div>
                  <div>
                    <dt className="text-sm text-gray-500">Approved</dt>
                    <dd className="text-gray-900">
                      {new Date(shop.approved_at).toLocaleString("en-NP", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Kathmandu",
                      })}
                    </dd>
                  </div>
                </div>
              )}
              {shop.rejected_at && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xs font-bold">2</div>
                  <div>
                    <dt className="text-sm text-gray-500">Rejected</dt>
                    <dd className="text-gray-900">
                      {new Date(shop.rejected_at).toLocaleString("en-NP", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Kathmandu",
                      })}
                    </dd>
                    {shop.rejection_reason && (
                      <dd className="text-sm text-red-600 mt-1">Reason: {shop.rejection_reason}</dd>
                    )}
                  </div>
                </div>
              )}
              {shop.suspended_at && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 text-xs font-bold">3</div>
                  <div>
                    <dt className="text-sm text-gray-500">Suspended</dt>
                    <dd className="text-gray-900">
                      {new Date(shop.suspended_at).toLocaleString("en-NP", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Kathmandu",
                      })}
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
