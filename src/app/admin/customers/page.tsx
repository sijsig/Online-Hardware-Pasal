import { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ExportButton } from "@/components/admin/export-button";

export const metadata: Metadata = { title: "Customers - Admin", robots: { index: false, follow: false } };

type Customer = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  role: string;
};

async function getCustomers() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, phone, email, created_at, role")
    .eq("role", "customer")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data as Customer[]) ?? [];
}

async function getOrderCounts(customerIds: string[]) {
  if (customerIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("customer_id")
    .in("customer_id", customerIds);
  
  const counts = new Map<string, number>();
  (data ?? []).forEach(order => {
    counts.set(order.customer_id, (counts.get(order.customer_id) || 0) + 1);
  });
  return counts;
}

async function getTotalSpent(customerIds: string[]) {
  if (customerIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("customer_id, total")
    .in("customer_id", customerIds)
    .eq("status", "delivered");
  
  const totals = new Map<string, number>();
  (data ?? []).forEach(order => {
    totals.set(order.customer_id, (totals.get(order.customer_id) || 0) + Number(order.total));
  });
  return totals;
}

export default async function CustomersPage() {
  const customers = await getCustomers();
  
  const customerIds = customers.map(c => c.id);
  const [orderCounts, totalSpent] = await Promise.all([
    getOrderCounts(customerIds),
    getTotalSpent(customerIds),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-600 mt-1">View and manage customer accounts</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {customers.length} registered customers
          </span>
          <ExportButton
            apiUrl="/api/admin/export/customers"
            filename="customers"
            label="Export"
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
            variant="outline"
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {customers.length === 0 ? (
          <div className="py-12 text-center">
            <span className="text-4xl" aria-hidden="true">👥</span>
            <h3 className="mt-2 text-lg font-medium text-gray-900">No customers yet</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" role="table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Orders</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Spent</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{customer.full_name || "Unnamed"}</p>
                      <p className="text-sm text-gray-500 font-mono">#{customer.id.slice(0, 8).toUpperCase()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900">{customer.phone || "No phone"}</p>
                      <p className="text-sm text-gray-500">{customer.email || "No email"}</p>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {orderCounts.get(customer.id) || 0}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      Rs. {(totalSpent.get(customer.id) || 0).toLocaleString("en-NP")}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(customer.created_at).toLocaleDateString("en-NP", {
                        dateStyle: "medium",
                        timeZone: "Asia/Kathmandu",
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/admin/customers/${customer.id}`} className="text-sm text-orange-600 hover:text-orange-700 font-medium">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
