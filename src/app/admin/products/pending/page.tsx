import { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pending Products - Admin", robots: { index: false, follow: false } };

type PendingProduct = {
  id: string;
  vendor_id: string;
  product_id: string | null;
  category_id: string | null;
  product_name: string;
  brand: string | null;
  model: string | null;
  unit: string;
  price: number;
  stock_quantity: number;
  vendor_sku: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

type Category = {
  id: string;
  name: string;
};

async function getPendingProducts() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendor_product_submissions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);
  return (data as PendingProduct[]) ?? [];
}

async function getCategories() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  return (data as Category[]) ?? [];
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

export default async function PendingProductsPage() {
  const [submissions, categories] = await Promise.all([
    getPendingProducts(),
    getCategories(),
  ]);

  const vendorIds = [...new Set(submissions.map(s => s.vendor_id))];
  const vendorNames = await getVendorNames(vendorIds);
  const categoryNames = new Map(categories.map(c => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pending Product Approvals</h1>
          <p className="text-gray-600 mt-1">Review and approve vendor-submitted products</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {submissions.length === 0 ? (
          <div className="py-12 text-center">
            <span className="text-4xl" aria-hidden="true">✅</span>
            <h3 className="mt-2 text-lg font-medium text-gray-900">All caught up!</h3>
            <p className="text-gray-500 mt-1">No pending product submissions at the moment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" role="table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Shop</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {submissions.map((submission) => (
                  <tr key={submission.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{submission.product_name}</p>
                      <p className="text-sm text-gray-500">
                        {submission.brand || "No brand"} · {submission.model || "No model"} · {submission.unit}
                      </p>
                      {submission.vendor_sku && (
                        <p className="text-xs text-gray-400 font-mono">SKU: {submission.vendor_sku}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {submission.category_id ? categoryNames.get(submission.category_id) || "Unknown" : "Uncategorized"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {vendorNames.get(submission.vendor_id) || "Unknown shop"}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      Rs. {Number(submission.price).toLocaleString("en-NP")}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`${submission.stock_quantity < 10 ? "text-red-600 font-medium" : "text-gray-900"}`}>
                        {submission.stock_quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(submission.created_at).toLocaleString("en-NP", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Kathmandu",
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="text-sm text-green-600 hover:text-green-700 font-medium">Approve</button>
                        <button className="text-sm text-red-600 hover:text-red-700 font-medium">Reject</button>
                        <Link href={`/admin/products/${submission.id}`} className="text-sm text-orange-600 hover:text-orange-700 font-medium">
                          Edit
                        </Link>
                      </div>
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
