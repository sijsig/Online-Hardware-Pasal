import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  return { title: `Order ${resolvedParams.id} - Admin`, robots: { index: false, follow: false } };
}

type OrderDetail = {
  id: string;
  customer_id: string;
  vendor_id: string;
  total: number;
  subtotal: number;
  delivery_fee: number;
  commission_rate: number;
  commission_amount: number;
  status: string;
  payment_method: string;
  payment_status: string;
  delivery_address_snapshot: {
    address_line?: string;
    city?: string;
    phone?: string;
    full_name?: string;
  };
  created_at: string;
  confirmed_at: string | null;
  delivered_at: string | null;
};

type OrderItem = {
  id: string;
  product_id: string;
  product_name: string;
  product_brand: string | null;
  product_model: string | null;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type Vendor = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address_line: string;
  city: string;
};

type Customer = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

type DeliveryAssignment = {
  id: string;
  rider_id: string;
  status: string;
  created_at: string;
  picked_up_at: string | null;
  delivered_at: string | null;
};

async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  return data as OrderDetail | null;
}

async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);
  return (data as OrderItem[]) ?? [];
}

async function getVendor(vendorId: string): Promise<Vendor | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendors")
    .select("id, name, phone, email, address_line, city")
    .eq("id", vendorId)
    .maybeSingle();
  return data as Vendor | null;
}

async function getCustomer(customerId: string): Promise<Customer | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, phone, email")
    .eq("id", customerId)
    .maybeSingle();
  return data as Customer | null;
}

async function getDeliveryAssignment(orderId: string): Promise<DeliveryAssignment | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("delivery_assignments")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as DeliveryAssignment | null;
}

const statusConfig = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700", step: 1 },
  confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-700", step: 2 },
  preparing: { label: "Preparing", className: "bg-purple-100 text-purple-700", step: 3 },
  delivering: { label: "Delivering", className: "bg-orange-100 text-orange-700", step: 4 },
  delivered: { label: "Delivered", className: "bg-green-100 text-green-700", step: 5 },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700", step: 0 },
} as const;

const statusOrder = ["pending", "confirmed", "preparing", "delivering", "delivered"] as const;

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const [order, items, vendor, customer, delivery] = await Promise.all([
    getOrderDetail(id),
    getOrderItems(id),
    getOrderDetail(id).then(o => o?.vendor_id ? getVendor(o.vendor_id) : null),
    getOrderDetail(id).then(o => o?.customer_id ? getCustomer(o.customer_id) : null),
    getDeliveryAssignment(id),
  ]);

  if (!order) notFound();

  const currentStatus = statusConfig[order.status as keyof typeof statusConfig] || { label: order.status, className: "bg-gray-100 text-gray-700", step: 0 };
  const currentStep = currentStatus.step;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/orders"
            className="text-gray-500 hover:text-gray-700"
            aria-label="Back to orders"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Order Details</h1>
            <p className="text-gray-500 mt-0.5">
              ID: <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{order.id.slice(0, 8).toUpperCase()}</code>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${currentStatus.className}`}>
            {currentStatus.label}
          </span>
        </div>
      </div>

      {/* Status Timeline */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Order Progress</h2>
        </div>
        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-6">
            {statusOrder.map((status, index) => {
              const step = index + 1;
              const isCompleted = step < currentStep;
              const isCurrent = step === currentStep;
              const isCancelled = order.status === "cancelled";
              const config = statusConfig[status];
              
              return (
                <div key={status} className="relative flex items-start gap-4">
                  <div className={`relative flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    isCompleted ? "bg-green-600 text-white" :
                    isCurrent && !isCancelled ? "bg-orange-600 text-white ring-4 ring-orange-200" :
                    "bg-gray-200 text-gray-400"
                  }`}>
                    {isCompleted ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step
                    )}
                  </div>
                  <div className="flex-1 pt-1">
                    <p className={`font-medium ${isCompleted || isCurrent ? "text-gray-900" : "text-gray-500"}`}>
                      {config.label}
                    </p>
                    {(() => {
                      const timestamp = 
                        status === "confirmed" ? order.confirmed_at :
                        status === "delivered" ? order.delivered_at :
                        status === "pending" ? order.created_at : null;
                      return timestamp ? (
                        <p className="text-sm text-gray-500 mt-0.5">
                          {new Date(timestamp).toLocaleString("en-NP", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: "Asia/Kathmandu",
                          })}
                        </p>
                      ) : null;
                    })()}
                  </div>
                </div>
              );
            })}
            {order.status === "cancelled" && (
              <div className="relative flex items-start gap-4">
                <div className="relative flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-sm font-bold">✕</div>
                <div className="flex-1 pt-1">
                  <p className="font-medium text-red-700">Cancelled</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column - Order Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <section className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Order Items ({items.length})</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50">
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-2xl">🔧</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{item.product_name}</p>
                    <p className="text-sm text-gray-500">
                      {item.product_brand || "No brand"} · {item.product_model || "No model"} · {item.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">Qty: {item.quantity}</p>
                    <p className="text-sm text-gray-500">Rs. {Number(item.unit_price).toLocaleString("en-NP")} each</p>
                    <p className="font-medium text-gray-900">Rs. {Number(item.total_price).toLocaleString("en-NP")}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Price Breakdown */}
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Price Breakdown</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Subtotal</dt><dd className="font-medium text-gray-900">Rs. {Number(order.subtotal).toLocaleString("en-NP")}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Delivery Fee</dt><dd className="font-medium text-gray-900">Rs. {Number(order.delivery_fee).toLocaleString("en-NP")}</dd></div>
              <div className="border-t border-gray-200 pt-3 flex justify-between">
                <dt className="font-medium text-gray-900">Total</dt>
                <dd className="font-bold text-lg text-gray-900">Rs. {Number(order.total).toLocaleString("en-NP")}</dd>
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between text-sm text-gray-500">
                <dt>Commission ({(order.commission_rate * 100).toFixed(1)}%)</dt>
                <dd>Rs. {Number(order.commission_amount).toLocaleString("en-NP")}</dd>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <dt>Vendor Payout</dt>
                <dd>Rs. {Number(order.subtotal - order.commission_amount).toLocaleString("en-NP")}</dd>
              </div>
            </dl>
          </section>
        </div>

        {/* Right column - Customer, Shop, Delivery */}
        <div className="space-y-6">
          {/* Customer */}
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer</h2>
            {customer ? (
              <div className="space-y-3">
                <p className="font-medium text-gray-900">{customer.full_name || "Unknown"}</p>
                <p className="text-sm text-gray-500">{customer.phone || "No phone"}</p>
                <p className="text-sm text-gray-500">{customer.email || "No email"}</p>
              </div>
            ) : (
              <p className="text-gray-500">Customer info not available</p>
            )}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">Delivery Address</p>
              <p className="mt-1 text-gray-900 whitespace-pre-wrap">
                {order.delivery_address_snapshot?.full_name || ""}
                {order.delivery_address_snapshot?.address_line || ""}
                {order.delivery_address_snapshot?.city || ""}
                {order.delivery_address_snapshot?.phone && `\n${order.delivery_address_snapshot.phone}`}
              </p>
            </div>
          </section>

          {/* Shop */}
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Shop</h2>
            {vendor ? (
              <div className="space-y-3">
                <Link href={`/admin/shops/${vendor.id}`} className="font-medium text-gray-900 hover:text-orange-600">
                  {vendor.name}
                </Link>
                <p className="text-sm text-gray-500">{vendor.phone || "No phone"}</p>
                <p className="text-sm text-gray-500">{vendor.email || "No email"}</p>
                <p className="text-sm text-gray-500">{vendor.address_line}, {vendor.city}</p>
              </div>
            ) : (
              <p className="text-gray-500">Shop info not available</p>
            )}
          </section>

          {/* Delivery */}
          {delivery && (
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Delivery</h2>
              <div className="space-y-3">
                <p className="text-sm text-gray-500">Rider: <span className="font-medium text-gray-900 font-mono">{delivery.rider_id.slice(0, 8).toUpperCase()}</span></p>
                <p className="text-sm text-gray-500">Status: <span className="font-medium text-gray-900 capitalize">{delivery.status}</span></p>
                <p className="text-sm text-gray-500">Assigned: <span className="font-medium text-gray-900">{new Date(delivery.created_at).toLocaleString("en-NP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" })}</span></p>
                {delivery.picked_up_at && (
                  <p className="text-sm text-gray-500">Picked up: <span className="font-medium text-gray-900">{new Date(delivery.picked_up_at).toLocaleString("en-NP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" })}</span></p>
                )}
                {delivery.delivered_at && (
                  <p className="text-sm text-gray-500">Delivered: <span className="font-medium text-gray-900">{new Date(delivery.delivered_at).toLocaleString("en-NP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" })}</span></p>
                )}
              </div>
            </section>
          )}

          {/* Payment */}
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Method</dt><dd className="font-medium text-gray-900 capitalize">{order.payment_method.replace("_", " ")}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Status</dt><dd className="font-medium text-gray-900 capitalize">{order.payment_status}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Amount</dt><dd className="font-bold text-lg text-gray-900">Rs. {Number(order.total).toLocaleString("en-NP")}</dd></div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
