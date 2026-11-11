"use client";

import { useEffect, useState } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  approveRider, 
  rejectRider, 
  updateRiderStatus 
} from "@/actions/admin/riders";
import { 
  bulkApproveRiders, 
  bulkRejectRiders, 
  bulkUpdateRiderStatus 
} from "@/actions/admin/bulk-riders";
import { useBulkActions } from "@/hooks/useBulkActions";
import { 
  BulkActionToolbar, 
  TableHeaderCheckbox, 
  CheckboxColumn 
} from "@/components/admin/bulk-action-toolbar";
import { ExportButton } from "@/components/admin/export-button";
import { RIDER_STATUS_CONFIG, RIDER_APP_STATUS_CONFIG } from "@/types/admin";

export const metadata: Metadata = { title: "Riders - Admin", robots: { index: false, follow: false } };

type Rider = {
  id: string;  // maps to user_id
  user_id: string;
  vehicle_type: string | null;
  license_number: string | null;
  status: "offline" | "available" | "busy" | "suspended";
  application_status: "pending" | "approved" | "rejected";
  created_at: string;
  approved_at: string | null;
};

function RidersTable({ 
  riders, 
  tab,
  onApprove,
  onReject,
  onUpdateStatus,
}: {
  riders: Rider[];
  tab: string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onUpdateStatus: (id: string, status: "offline" | "available" | "busy" | "suspended") => Promise<{ success: boolean }>;
}) {
  const {
    selectedIds,
    selectedCount,
    selectAll,
    isIndeterminate,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    executeBulkAction,
    loading,
    configs,
  } = useBulkActions(riders, [
    {
      label: "Approve",
      icon: "✅",
      action: async (ids: string[]) => {
        const result = await bulkApproveRiders(ids);
        return { success: result.successCount > 0, error: result.errors.join(", ") || undefined };
      },
      successMessage: "{count} rider(s) approved successfully",
      errorMessage: "Failed to approve riders",
      confirmMessage: "Approve {count} rider(s)? They can start receiving deliveries.",
      variant: "default",
      available: (items) => items.some(r => r.application_status === "pending"),
    },
    {
      label: "Reject",
      icon: "❌",
      action: async (ids: string[]) => {
        const result = await bulkRejectRiders(ids);
        return { success: result.successCount > 0, error: result.errors.join(", ") || undefined };
      },
      successMessage: "{count} rider(s) rejected",
      errorMessage: "Failed to reject riders",
      confirmMessage: "Reject {count} rider(s)? This cannot be undone.",
      variant: "destructive",
      available: (items) => items.some(r => r.application_status === "pending"),
    },
    {
      label: "Set Available",
      icon: "🟢",
      action: async (ids: string[]) => {
        const result = await bulkUpdateRiderStatus(ids, "available");
        return { success: result.successCount > 0, error: result.errors.join(", ") || undefined };
      },
      successMessage: "{count} rider(s) set to available",
      errorMessage: "Failed to update status",
      confirmMessage: "Set {count} rider(s) to available?",
      variant: "default",
      available: (items) => items.some(r => r.application_status === "approved" && r.status !== "available"),
    },
    {
      label: "Set Offline",
      icon: "⚫",
      action: async (ids: string[]) => {
        const result = await bulkUpdateRiderStatus(ids, "offline");
        return { success: result.successCount > 0, error: result.errors.join(", ") || undefined };
      },
      successMessage: "{count} rider(s) set to offline",
      errorMessage: "Failed to update status",
      confirmMessage: "Set {count} rider(s) to offline?",
      variant: "outline",
      available: (items) => items.some(r => r.application_status === "approved" && r.status !== "offline"),
    },
    {
      label: "Suspend",
      icon: "⛔",
      action: async (ids: string[]) => {
        const result = await bulkUpdateRiderStatus(ids, "suspended");
        return { success: result.successCount > 0, error: result.errors.join(", ") || undefined };
      },
      successMessage: "{count} rider(s) suspended",
      errorMessage: "Failed to suspend riders",
      confirmMessage: "Suspend {count} rider(s)? They won't receive delivery offers.",
      variant: "destructive",
      available: (items) => items.some(r => r.application_status === "approved" && r.status !== "suspended"),
    },
  ]);

  const availableActions = configs
    .map((config, index) => ({ config, index }))
    .filter(({ config }) => config.available?.(riders.filter(r => selectedIds.has(r.id))) ?? true)
    .map(({ config, index }) => ({
      label: config.label,
      onClick: () => executeBulkAction(index),
      variant: config.variant,
      icon: config.icon,
      disabled: loading,
      confirmMessage: config.confirmMessage,
    }));

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {riders.length === 0 ? (
          <div className="py-12 text-center">
            <span className="text-4xl" aria-hidden="true">🛵</span>
            <h3 className="mt-2 text-lg font-medium text-gray-900">No riders found</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" role="table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-center w-12">
                    <TableHeaderCheckbox
                      checked={selectAll}
                      indeterminate={isIndeterminate}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rider</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vehicle</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Application</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {riders.map((rider) => {
                  const isSelected = selectedIds.has(rider.id);

                  return (
                    <tr 
                      key={rider.id} 
                      className={`hover:bg-gray-50 ${isSelected ? "bg-orange-50" : ""}`}
                    >
                      <td className="px-6 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(rider.id)}
                          className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                          aria-label={isSelected ? "Deselect" : "Select"}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-mono text-sm text-gray-900">{rider.user_id.slice(0, 8).toUpperCase()}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{rider.vehicle_type || "Not specified"}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${RIDER_STATUS_CONFIG[rider.status].className}`}>
                          {RIDER_STATUS_CONFIG[rider.status].label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${RIDER_APP_STATUS_CONFIG[rider.application_status].className}`}>
                          {RIDER_APP_STATUS_CONFIG[rider.application_status].label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(rider.created_at).toLocaleDateString("en-NP", {
                          dateStyle: "medium",
                          timeZone: "Asia/Kathmandu",
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {rider.application_status === "pending" && (
                            <>
                              <button
                                onClick={() => onApprove(rider.user_id)}
                                className="text-sm text-green-600 hover:text-green-700 font-medium"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => onReject(rider.user_id)}
                                className="text-sm text-red-600 hover:text-red-700 font-medium"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {rider.application_status === "approved" && (
                            <select
                              value={rider.status}
                              onChange={(e) => onUpdateStatus(rider.user_id, e.target.value as "offline" | "available" | "busy" | "suspended")}
                              className="text-sm border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="offline">Offline</option>
                              <option value="available">Available</option>
                              <option value="busy">Busy</option>
                              <option value="suspended">Suspended</option>
                            </select>
                          )}
                          <Link href={`/admin/riders/${rider.user_id}`} className="text-sm text-orange-600 hover:text-orange-700 font-medium">
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BulkActionToolbar
        selectedCount={selectedCount}
        totalCount={riders.length}
        selectAll={selectAll}
        isIndeterminate={isIndeterminate}
        onToggleSelectAll={toggleSelectAll}
        onClearSelection={clearSelection}
        onToggleSelect={toggleSelect}
        actions={availableActions}
      />
    </>
  );
}

export default function RidersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get("tab") || "all";
  
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    try {
      const supabase = createClient();
      let query = supabase
        .from("riders")
        .select("*")
        .order("created_at", { ascending: false });

      if (tab === "pending" || tab === "approved" || tab === "rejected") {
        query = query.eq("application_status", tab);
      }

      const { data: ridersData, error } = await query.limit(100);
      if (!error) {
        const mappedRiders = ((ridersData ?? []).map(r => ({ ...r, id: r.user_id })) as Rider[]);
        setRiders(mappedRiders);
      }
    } catch (error) {
      console.error("Failed to fetch riders:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [tab]);

  async function handleApprove(id: string) {
    try {
      await approveRider(id);
      setRiders(prev => prev.map(r => r.user_id === id ? { ...r, application_status: "approved" as const } : r));
    } catch (error) {
      console.error("Failed to approve rider:", error);
    }
  }

  async function handleReject(id: string) {
    try {
      await rejectRider(id);
      setRiders(prev => prev.map(r => r.user_id === id ? { ...r, application_status: "rejected" as const } : r));
    } catch (error) {
      console.error("Failed to reject rider:", error);
    }
  }

  async function handleUpdateStatus(id: string, status: "offline" | "available" | "busy" | "suspended") {
    try {
      await updateRiderStatus(id, status);
      setRiders(prev => prev.map(r => r.user_id === id ? { ...r, status } : r));
    } catch (error) {
      console.error("Failed to update rider status:", error);
    }
  }

  const tabs = [
    { value: "all", label: "All Riders", count: riders.length },
    { value: "pending", label: "Pending", count: riders.filter(r => r.application_status === "pending").length },
    { value: "approved", label: "Approved", count: riders.filter(r => r.application_status === "approved").length },
    { value: "rejected", label: "Rejected", count: riders.filter(r => r.application_status === "rejected").length },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Riders</h1>
            <p className="text-gray-600 mt-1">Manage delivery rider applications and status</p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto" />
            <p className="mt-2 text-gray-600">Loading riders...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Riders</h1>
          <p className="text-gray-600 mt-1">Manage delivery rider applications and status</p>
        </div>
        <div className="flex gap-3">
          <ExportButton
            data={riders}
            apiUrl="/api/admin/export/riders"
            filename={`riders_${tab}`}
            label="Export"
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
            variant="outline"
          />
        </div>
      </div>

      <div className="flex gap-1 rounded-lg bg-gray-100 p-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              if (t.value === "all") {
                params.delete("tab");
              } else {
                params.set("tab", t.value);
              }
              router.push(`/admin/riders?${params.toString()}`);
            }}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.value
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
            role="tab"
            aria-selected={tab === t.value}
          >
            {t.label}
            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <RidersTable 
        riders={riders} 
        tab={tab}
        onApprove={handleApprove}
        onReject={handleReject}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  );
}
