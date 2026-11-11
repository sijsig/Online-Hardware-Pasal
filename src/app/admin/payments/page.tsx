import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ExportButton } from "@/components/admin/export-button";

export const metadata: Metadata = { title: "Payments - Admin", robots: { index: false, follow: false } };

type Payment = {
  order_id: string;
  method: string;
  status: string;
  amount: number;
  currency: string;
  cash_collected_at: string | null;
  created_at: string;
};

type Commission = {
  id: string;
  order_id: string;
  vendor_id: string;
  subtotal_snapshot: number;
  rate_snapshot: number;
  commission_amount: number;
  vendor_payout: number;
  status: string;
  payout_reference: string | null;
  created_at: string;
};

async function getPayments() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data as Payment[]) ?? [];
}

async function getCommissions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("commissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data as Commission[]) ?? [];
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

export default async function PaymentsPage() {
  const [payments, commissions] = await Promise.all([getPayments(), getCommissions()]);
  
  const vendorIds = [...new Set(commissions.map(c => c.vendor_id))];
  const vendorNames = await getVendorNames(vendorIds);

  const totals = {
    totalRevenue: payments.reduce((sum, p) => sum + Number(p.amount), 0),
    totalCommission: commissions.reduce((sum, c) => sum + Number(c.commission_amount), 0),
    totalPayouts: commissions.filter(c => c.status === "paid").reduce((sum, c) => sum + Number(c.vendor_payout), 0),
    pendingPayouts: commissions.filter(c => c.status === "earned").reduce((sum, c) => sum + Number(c.vendor_payout), 0),
  };

  const statusConfig = {
    collected: { label: "Collected", className: "bg-green-100 text-green-700" },
    pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700" },
    failed: { label: "Failed", className: "bg-red-100 text-red-700" },
    refunded: { label: "Refunded", className: "bg-gray-100 text-gray-700" },
  } as const;

  const commissionStatusConfig = {
    earned: { label: "Earned", className: "bg-blue-100 text-blue-700" },
    paid: { label: "Paid", className: "bg-green-100 text-green-700" },
    pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700" },
  } as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments & Commissions</h1>
          <p className="text-gray-600 mt-1">Track payments, commissions, and vendor payouts</p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            apiUrl="/api/admin/export/payments"
            filename="payments"
            label="Export"
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
            variant="outline"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">Rs. {totals.totalRevenue.toLocaleString("en-NP")}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">Total Commission</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">Rs. {totals.totalCommission.toLocaleString("en-NP")}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">Paid to Vendors</p>
          <p className="mt-1 text-2xl font-bold text-green-700">Rs. {totals.totalPayouts.toLocaleString("en-NP")}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">Pending Payouts</p>
          <p className="mt-1 text-2xl font-bold text-yellow-700">Rs. {totals.pendingPayouts.toLocaleString("en-NP")}</p>
        </div>
      </div>

      {/* Payments */}
      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Payments</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {payments.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">No payments recorded</div>
          ) : (
            payments.map((payment) => (
              <div key={payment.order_id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono text-gray-500">#{payment.order_id.slice(0, 8).toUpperCase()}</span>
                  <div>
                    <p className="text-sm text-gray-900">{payment.method.replaceAll("_", " ")}</p>
                    <p className="text-xs text-gray-500">
                      {payment.cash_collected_at
                        ? `Collected ${new Date(payment.cash_collected_at).toLocaleDateString("en-NP", { dateStyle: "medium", timeZone: "Asia/Kathmandu" })}`
                        : "Collection not recorded"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-medium text-gray-900">Rs. {Number(payment.amount).toLocaleString("en-NP")}</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[payment.status as keyof typeof statusConfig]?.className || "bg-gray-100 text-gray-700"}`}>
                    {statusConfig[payment.status as keyof typeof statusConfig]?.label || payment.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Commissions */}
      <section className="rounded-xl border border-gray-200 bg-white mt-6">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Commission & Vendor Payout Ledger</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {commissions.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">No commissions recorded</div>
          ) : (
            commissions.map((commission) => (
              <div key={commission.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center gap-4 min-w-0">
                  <div>
                    <p className="font-medium text-gray-900 truncate">
                      {vendorNames.get(commission.vendor_id) || "Hardware shop"}
                    </p>
                    <p className="text-sm text-gray-500">Order #{commission.order_id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <div className="text-sm text-gray-500">
                    Rate {(Number(commission.rate_snapshot) * 100).toFixed(2)}% · 
                    Commission Rs. {Number(commission.commission_amount).toLocaleString("en-NP")} · 
                    Vendor due Rs. {Number(commission.vendor_payout).toLocaleString("en-NP")}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${commissionStatusConfig[commission.status as keyof typeof commissionStatusConfig]?.className || "bg-gray-100 text-gray-700"}`}>
                    {commissionStatusConfig[commission.status as keyof typeof commissionStatusConfig]?.label || commission.status}
                  </span>
                  {commission.status === "earned" && (
                    <button className="text-sm text-orange-600 hover:text-orange-700 font-medium">
                      Record Payout
                    </button>
                  )}
                  {commission.payout_reference && (
                    <span className="text-xs text-gray-500">Ref: {commission.payout_reference}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
