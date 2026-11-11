import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProductStatus } from "@/actions/admin/products";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  return { title: `Product ${resolvedParams.id.slice(0, 8)} - Admin`, robots: { index: false, follow: false } };
}

type Category = {
  id: string;
  name: string;
  slug: string;
};

type Product = {
  id: string;
  category_id: string | null;
  vendor_id: string | null;
  name: string;
  slug: string;
  brand: string | null;
  model: string | null;
  unit: string;
  price: number;
  stock_quantity: number;
  is_active: boolean;
  description: string | null;
  images: string[] | null;
  specifications: Record<string, any> | null;
  created_at: string;
  updated_at: string;
};

type Vendor = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address_line: string;
  city: string;
  district: string | null;
  province: string | null;
  status: string;
  gst_number: string | null;
  pan_number: string | null;
};

type Order = {
  id: string;
  status: string;
  created_at: string;
  vendor_id: string;
  total: number;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total: number;
  orders: Order[];
};

async function getProduct(productId: string): Promise<Product | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();
  return data as Product | null;
}

async function getCategory(categoryId: string | null): Promise<Category | null> {
  if (!categoryId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("id", categoryId)
    .maybeSingle();
  return data as Category | null;
}

async function getVendor(vendorId: string | null): Promise<Vendor | null> {
  if (!vendorId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendors")
    .select("id, name, phone, email, address_line, city, district, province, status, gst_number, pan_number")
    .eq("id", vendorId)
    .maybeSingle();
  return data as Vendor | null;
}

async function getOrderItems(productId: string): Promise<OrderItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_items")
    .select(`
      id,
      order_id,
      product_id,
      quantity,
      unit_price,
      total,
      orders:order_id (
        id,
        status,
        created_at,
        vendor_id,
        total
      )
    `)
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(50);
  
  return (data as OrderItem[]) ?? [];
}

async function getVendorNames(vendorIds: string[]) {
  if (vendorIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendors")
    .select("id, name")
    .in("id", vendorIds);
  return new Map((data ?? []).map(v => [v.id, v.name]));
}

const statusConfig = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700", icon: "⏳" },
  confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-700", icon: "✅" },
  preparing: { label: "Preparing", className: "bg-purple-100 text-purple-700", icon: "📦" },
  delivering: { label: "Delivering", className: "bg-orange-100 text-orange-700", icon: "🚚" },
  delivered: { label: "Delivered", className: "bg-green-100 text-green-700", icon: "📦" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700", icon: "❌" },
} as const;

function formatPrice(price: number) {
  return `Rs. ${price.toLocaleString("en-NP")}`;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString("en-NP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kathmandu",
  });
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const productId = resolvedParams.id;
  
  const product = await getProduct(productId);

  if (!product) {
    redirect("/admin/products");
  }

  const [category, vendor, orderItems] = await Promise.all([
    getCategory(product.category_id),
    getVendor(product.vendor_id),
    getOrderItems(productId),
  ]);

  const vendorNames = await getVendorNames(
    orderItems.map(o => o.orders[0]?.vendor_id).filter(Boolean)
  );

  const stats = {
    totalOrders: orderItems.length,
    totalQuantitySold: orderItems.reduce((sum, item) => sum + item.quantity, 0),
    totalRevenue: orderItems.reduce((sum, item) => sum + Number(item.total), 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/products"
            className="text-gray-500 hover:text-gray-700"
            aria-label="Back to products"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            <p className="text-gray-600 mt-1">
              <span className="font-mono text-sm">#{product.id.slice(0, 8).toUpperCase()}</span>
              {product.brand && (
                <>
                  <span className="mx-2">·</span>
                  <span>{product.brand}</span>
                </>
              )}
              {product.model && (
                <>
                  <span className="mx-2">·</span>
                  <span>{product.model}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${product.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
            {product.is_active ? "Active" : "Inactive"}
          </span>
          <button
            onClick={() => updateProductStatus(product.id, !product.is_active)}
            className={`text-sm font-medium px-4 py-2 rounded-lg ${product.is_active ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"}`}
          >
            {product.is_active ? "Deactivate" : "Activate"}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Product Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product Images */}
          {(product.images && product.images.length > 0) && (
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Images</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {product.images.map((image, index) => (
                  <div key={index} className="relative aspect-square rounded-lg border border-gray-200 overflow-hidden">
                    <img
                      src={image}
                      alt={`${product.name} - Image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Basic Information */}
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-gray-500">Slug</dt>
                <dd className="mt-1 font-mono text-sm text-gray-900">{product.slug}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Category</dt>
                <dd className="mt-1 text-gray-900">
                  {category ? (
                    <Link href={`/admin/categories/${category.id}`} className="text-orange-600 hover:text-orange-700">
                      {category.name}
                    </Link>
                  ) : (
                    <span className="text-gray-500">Uncategorized</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Brand</dt>
                <dd className="mt-1 text-gray-900">{product.brand || "Not specified"}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Model</dt>
                <dd className="mt-1 text-gray-900">{product.model || "Not specified"}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Unit</dt>
                <dd className="mt-1 text-gray-900">{product.unit}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Price</dt>
                <dd className="mt-1 text-xl font-bold text-gray-900">{formatPrice(product.price)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Stock Quantity</dt>
                <dd className={`mt-1 text-xl font-bold ${product.stock_quantity < 10 ? "text-red-600" : "text-gray-900"}`}>
                  {product.stock_quantity}
                  {product.stock_quantity < 10 && <span className="ml-2 text-sm text-red-600">⚠ Low Stock</span>}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Status</dt>
                <dd className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${product.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                    {product.is_active ? "Active" : "Inactive"}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          {/* Description */}
          {product.description && (
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Description</h2>
              <div className="prose prose-sm max-w-none text-gray-700">
                {product.description.split("\n").map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </section>
          )}

          {/* Specifications */}
          {product.specifications && Object.keys(product.specifications).length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Specifications</h2>
              <dl className="grid gap-4 sm:grid-cols-2">
                {Object.entries(product.specifications).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-sm text-gray-500 capitalize">{key.replace(/_/g, " ")}</dt>
                    <dd className="mt-1 text-gray-900">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Order History */}
          <section className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Order History</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {orderItems.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">No orders for this product yet</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Shop</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit Price</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderItems.map((item) => {
                          const order = item.orders[0];
                          return (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4">
                                <Link href={`/admin/orders/${order?.id}`} className="font-mono text-sm text-orange-600 hover:text-orange-700">
                                  #{order?.id.slice(0, 8).toUpperCase()}
                                </Link>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {order ? vendorNames.get(order.vendor_id) || "Unknown" : "Unknown"}
                              </td>
                              <td className="px-6 py-4 font-medium text-gray-900">{item.quantity}</td>
                              <td className="px-6 py-4 text-gray-900">{formatPrice(item.unit_price)}</td>
                              <td className="px-6 py-4 font-medium text-gray-900">{formatPrice(item.total)}</td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${order ? statusConfig[order.status as keyof typeof statusConfig]?.className || "bg-gray-100 text-gray-700" : "bg-gray-100 text-gray-700"}`}>
                                  {order ? statusConfig[order.status as keyof typeof statusConfig]?.icon : ""}
                                  {order ? statusConfig[order.status as keyof typeof statusConfig]?.label || order.status : "Unknown"}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {order ? formatDate(order.created_at) : ""}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Vendor Info */}
          {vendor && (
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Shop Information</h2>
              <div className="space-y-4">
                <div>
                  <dt className="text-sm text-gray-500">Shop Name</dt>
                  <dd className="mt-1 font-medium text-gray-900">{vendor.name}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Contact</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {vendor.phone || "No phone"}
                    {vendor.email && (
                      <>
                        <br />
                        <span className="text-gray-500">{vendor.email}</span>
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Address</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {vendor.address_line}, {vendor.city}
                    {vendor.district && (
                      <>
                        <span className="mx-1">·</span>
                        {vendor.district}
                      </>
                    )}
                    {vendor.province && (
                      <>
                        <span className="mx-1">·</span>
                        {vendor.province}
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Status</dt>
                  <dd className="mt-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      {vendor.status}
                    </span>
                  </dd>
                </div>
                {vendor.gst_number && (
                  <div>
                    <dt className="text-sm text-gray-500">GST Number</dt>
                    <dd className="mt-1 font-mono text-sm text-gray-900">{vendor.gst_number}</dd>
                  </div>
                )}
                {vendor.pan_number && (
                  <div>
                    <dt className="text-sm text-gray-500">PAN Number</dt>
                    <dd className="mt-1 font-mono text-sm text-gray-900">{vendor.pan_number}</dd>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Product Stats */}
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance</h2>
            <dl className="space-y-4">
              <div className="flex justify-between">
                <dt className="text-gray-500">Total Orders</dt>
                <dd className="font-semibold text-gray-900">{stats.totalOrders}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Units Sold</dt>
                <dd className="font-semibold text-gray-900">{stats.totalQuantitySold}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Revenue Generated</dt>
                <dd className="font-semibold text-gray-900">{formatPrice(stats.totalRevenue)}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-4">
                <dt className="text-gray-500">Current Stock</dt>
                <dd className={`font-semibold ${product.stock_quantity < 10 ? "text-red-600" : "text-gray-900"}`}>
                  {product.stock_quantity}
                </dd>
              </div>
            </dl>
          </section>

          {/* Timestamps */}
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Timestamps</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-900 font-mono">{formatDate(product.created_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Updated</dt>
                <dd className="text-gray-900 font-mono">{formatDate(product.updated_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Product ID</dt>
                <dd className="text-gray-900 font-mono">{product.id}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
