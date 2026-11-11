import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  return { title: `Rider ${resolvedParams.id} - Admin`, robots: { index: false, follow: false } };
}

type RiderDetail = {
  user_id: string;
  vehicle_type: string | null;
  license_number: string | null;
  status: "offline" | "available" | "busy" | "suspended";
  application_status: "pending" | "approved" | "rejected";
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
};

type Delivery = {
  id: string;
  order_id: string;
  status: string;
  created_at: string;
  picked_up_at: string | null;
  delivered_at: string | null;
};

async function getRiderDetail(riderId: string): Promise<RiderDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("riders")
    .select("*")
    .eq("user_id", riderId)
    .maybeSingle();
  return data as RiderDetail | null;
}

async function getRiderDeliveries(riderId: string): Promise<Delivery[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("delivery_assignments")
    .select("id, order_id, status, created_at, picked_up_at, delivered_at")
    .eq("rider_id", riderId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data as Delivery[]) ?? [];
}

async function getRiderProfile(riderId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name, phone, email")
    .eq("id", riderId)
    .maybeSingle();
  return data;
}

const statusConfig = {
  offline: { label: "Offline", className: "bg-gray-100 text-gray-700" },
  available: { label: "Available", className: "bg-green-100 text-green-700" },
  busy: { label: "Busy", className: "bg-blue-100 text-blue-700" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-700" },
} as const;

const appStatusConfig = {
  pending: { label: "Pending Review", className: "bg-yellow-100 text-yellow-700" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
} as const;

export default async function RiderDetailPage({ params }: Props) {
  const { id } = await params;
  const [rider, deliveries, profile] = await Promise.all([
    getRiderDetail(id),
    getRiderDeliveries(id),
    getRiderProfile(id),
  ]);

  if (!rider) notFound();

  const currentStatus = statusConfig[rider.status];
  const appStatus = appStatusConfig[rider.application_status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/riders"
            className="text-gray-500 hover:text-gray-700"
            aria-label="Back to riders"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rider Details</h1>
            <p className="text-gray-500 mt-0.5">
              ID: <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{rider.user_id.slice(0, 8).toUpperCase()}</code>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${currentStatus.className}`}>
            {currentStatus.label}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${appStatus.className}`}>
            {appStatus.label}
          </span>
        </div>
      </div>

      {/* Action Buttons for pending riders */}
      {rider.application_status === "pending" && (
        <div className="flex flex-wrap gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800 flex-1">
            This rider application is pending review.
          </p>
          <div className="flex gap-2">
            <button className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
              Approve Rider
            </button>
            <button className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column - Profile & Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile */}
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center text-3xl font-bold text-orange-600">
                {profile?.full_name?.[0]?.toUpperCase() || rider.user_id[0]?.toUpperCase() || "R"}
              </div>
              <div>
                <p className="text-xl font-medium text-gray-900">{profile?.full_name || "Unknown"}</p>
                <p className="text-sm text-gray-500">Rider #{rider.user_id.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-gray-500">Phone</dt>
                <dd className="mt-1 font-medium text-gray-900">{profile?.phone || "Not provided"}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Email</dt>
                <dd className="mt-1 font-medium text-gray-900">{profile?.email || "Not provided"}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Vehicle</dt>
                <dd className="mt-1 font-medium text-gray-900">{rider.vehicle_type || "Not specified"}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">License</dt>
                <dd className="mt-1 font-medium text-gray-900">{rider.license_number || "Not provided"}</dd>
              </div>
            </dl>
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
                    {new Date(rider.created_at).toLocaleString("en-NP", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Kathmandu",
                    })}
                  </dd>
                </div>
              </div>
              {rider.approved_at && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs font-bold">2</div>
                  <div>
                    <dt className="text-sm text-gray-500">Approved</dt>
                    <dd className="text-gray-900">
                      {new Date(rider.approved_at).toLocaleString("en-NP", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Kathmandu",
                      })}
                    </dd>
                  </div>
                </div>
              )}
              {rider.rejected_at && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xs font-bold">2</div>
                  <div>
                    <dt className="text-sm text-gray-500">Rejected</dt>
                    <dd className="text-gray-900">
                      {new Date(rider.rejected_at).toLocaleString("en-NP", {
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

          {/* Recent Deliveries */}
          <section className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Deliveries ({deliveries.length})</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {deliveries.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">No deliveries yet</div>
              ) : (
                deliveries.map((delivery) => (
                  <div key={delivery.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50">
                    <div>
                      <p className="font-mono text-sm text-gray-500">Order #{delivery.order_id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(delivery.created_at).toLocaleString("en-NP", {
                          dateStyle: "short",
                          timeStyle: "short",
                          timeZone: "Asia/Kathmandu",
                        })}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      delivery.status === "delivered" ? "bg-green-100 text-green-700" :
                      delivery.status === "picked_up" ? "bg-blue-100 text-blue-700" :
                      delivery.status === "accepted" ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {delivery.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right column - Stats & Status */}
        <div className="space-y-6">
          {/* Stats */}
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h2>
            <dl className="space-y-4">
              <div className="flex justify-between">
                <dt className="text-gray-500">Total Deliveries</dt>
                <dd className="font-bold text-2xl text-gray-900">{deliveries.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Completed</dt>
                <dd className="font-bold text-2xl text-green-700">
                  {deliveries.filter(d => d.status === "delivered").length}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">In Progress</dt>
                <dd className="font-bold text-2xl text-blue-700">
                  {deliveries.filter(d => d.status === "picked_up" || d.status === "accepted").length}
                </dd>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">Joined: {new Date(rider.created_at).toLocaleDateString("en-NP", { dateStyle: "medium", timeZone: "Asia/Kathmandu" })}</p>
              </div>
            </dl>
          </section>

          {/* Status Management */}
          {rider.application_status === "approved" && (
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Manage Status</h2>
              <p className="text-sm text-gray-500 mb-4">Update rider availability status</p>
              <div className="space-y-2">
                {Object.entries(statusConfig).map(([key, config]) => (
                  <label key={key} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${rider.status === key ? "border-orange-300 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <input
                      type="radio"
                      name="rider-status"
                      value={key}
                      defaultChecked={rider.status === key}
                      className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                    />
                    <span className="font-medium text-gray-900 capitalize">{config.label}</span>
                  </label>
                ))}
              </div>
              <button className="mt-4 w-full rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700">
                Update Status
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
