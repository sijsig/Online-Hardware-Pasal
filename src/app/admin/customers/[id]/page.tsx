import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  return { title: `Customer ${resolvedParams.id} - Admin`, robots: { index: false, follow: false } };
}

type CustomerDetail = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  created_at: string;
};

type Order = {
  id: string;
  total: number;
  status: string;
  created_at: string;
  vendor_id: string;
};

async function getCustomerDetail(customerId: string): Promise<CustomerDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", customerId)
    .maybeSingle();
  return data as CustomerDetail | null;
}

async function getCustomerOrders(customerId: string): Promise<Order[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, total, status, created_at, vendor_id")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data as Order[]) ?? [];
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
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700" },
  confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-700" },
  preparing: { label: "Preparing", className: "bg-purple-100 text-purple-700" },
  delivering: { label: "Delivering", className: "bg-orange-100 text-orange-700" },
  delivered: { label: "Delivered", className: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700" },
} as const;

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const [customer, orders] = await Promise.all([
    getCustomerDetail(id),
    getCustomerOrders(id),
  ]);

  if (!customer) notFound();

  const vendorIds = [...new Set(orders.map(o => o.vendor_id))];
  const vendorNames = await getVendorNames(vendorIds);

  const totalSpent = orders
    .filter(o => o.status === "delivered")
    .reduce((sum, o) => sum + Number(o.total), 0);
  const totalOrders = orders.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/customers"
            className="text-gray-500 hover:text-gray-700"
            aria-label="Back to customers"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customer Details</h1>
            <p className="text-gray-500 mt-0.5">
              ID: <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{customer.id.slice(0, 8).toUpperCase()}</code>
            </p>
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column - Profile & Orders */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile */}
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center text-3xl font-bold text-orange-600">
                {customer.full_name?.[0]?.toUpperCase() || "U"}
              </div>
              <div>
                <p className="text-xl font-medium text-gray-900">{customer.full_name || "Unnamed"}</p>
                <p className="text-sm text-gray-500">Customer since {new Date(customer.created_at).toLocaleDateString("en-NP", { dateStyle: "medium", timeZone: "Asia/Kathmandu" })}</p>
              </div>
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-sm text-gray-500">Email</dt>
                <dd className="mt-1 font-medium text-gray-900">{customer.email || "Not provided"}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Phone</dt>
                <dd className="mt-1 font-medium text-gray-900">{customer.phone || "Not provided"}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Role</dt>
                <dd className="mt-1 font-medium text-gray-900 capitalize">{customer.role}</dd>
              </div>
            </dl>
          </section>

          {/* Stats */}
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="p-4 rounded-lg bg-gray-50">
                <p className="text-sm text-gray-500">Total Orders</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{totalOrders}</p>
              </div>
              <div className="p-4 rounded-lg bg-gray-50">
                <p className="text-sm text-gray-500">Total Spent</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">Rs. {totalSpent.toLocaleString("en-NP")}</p>
              </div>
              <div className="p-4 rounded-lg bg-gray-50">
                <p className="text-sm text-gray-500">Avg. Order Value</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  Rs. {totalOrders > 0 ? Math.round(totalSpent / totalOrders).toLocaleString("en-NP") : "0"}
                </p>
              </div>
            </div>
          </section>

          {/* Orders */}
          <section className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Order History ({orders.length})</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {orders.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">No orders yet</div>
              ) : (
                orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <Link href={`/admin/orders/${order.id}`} className="font-mono text-sm text-orange-600 hover:text-orange-700">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </Link>
                      <div>
                        <p className="text-sm text-gray-900">{vendorNames.get(order.vendor_id) || "Unknown shop"}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(order.created_at).toLocaleString("en-NP", {
                            dateStyle: "short",
                            timeStyle: "short",
                            timeZone: "Asia/Kathmandu",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">Rs. {Number(order.total).toLocaleString("en-NP")}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[order.status as keyof typeof statusConfig]?.className || "bg-gray-100 text-gray-700"}`}>
                        {statusConfig[order.status as keyof typeof statusConfig]?.label || order.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right column - Activity */}
        <div className="space-y-6">
          {/* Recent Activity */}
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
            {orders.length > 0 ? (
              <dl className="space-y-4">
                {orders.slice(0, 5).map((order) => (
                  <div key={order.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-sm font-bold">
                      📦
                    </div>
                    <div>
                      <dt className="font-medium text-gray-900">Order #{order.id.slice(0, 8).toUpperCase()}</dt>
                      <dd className="text-sm text-gray-500">
                        Rs. {Number(order.total).toLocaleString("en-NP")} · {statusConfig[order.status as keyof typeof statusConfig]?.label || order.status}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-gray-500 text-center py-4">No recent activity</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
