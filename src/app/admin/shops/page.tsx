"use client";

import { useEffect, useState } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  approveShop, 
  rejectShop, 
  suspendShop, 
  activateShop 
} from "@/actions/admin/shops";
import { 
  bulkApproveShops, 
  bulkRejectShops, 
  bulkSuspendShops, 
  bulkActivateShops 
} from "@/actions/admin/bulk-shops";
import { useBulkActions } from "@/hooks/useBulkActions";
import { 
  BulkActionToolbar, 
  TableHeaderCheckbox, 
  CheckboxColumn 
} from "@/components/admin/bulk-action-toolbar";
import { ExportButton } from "@/components/admin/export-button";
import { SHOP_STATUS_CONFIG } from "@/types/admin";


type Shop = {
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
};

type Owner = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

function ShopsTable({ 
  shops, 
  owners, 
  tab,
  onApprove,
  onReject,
  onSuspend,
  onActivate,
}: {
  shops: Shop[];
  owners: Map<string, Owner>;
  tab: string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onSuspend: (id: string) => void;
  onActivate: (id: string) => void;
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
  } = useBulkActions(shops, [
    {
      label: "Approve",
      icon: "✅",
      action: async (id: string) => {
        const result = await bulkApproveShops([id]);
        return { success: result.successCount > 0, error: result.errors.join(", ") || undefined };
      },
      successMessage: "{count} shop(s) approved successfully",
      errorMessage: "Failed to approve shops",
      confirmMessage: "Approve {count} shop(s)? They will be able to receive orders.",
      variant: "default",
      available: (items) => items.some(s => s.status === "pending"),
    },
    {
      label: "Reject",
      icon: "❌",
      action: async (id: string) => {
        const result = await bulkRejectShops([id]);
        return { success: result.successCount > 0, error: result.errors.join(", ") || undefined };
      },
      successMessage: "{count} shop(s) rejected",
      errorMessage: "Failed to reject shops",
      confirmMessage: "Reject {count} shop(s)? This cannot be undone.",
      variant: "destructive",
      available: (items) => items.some(s => s.status === "pending"),
    },
    {
      label: "Suspend",
      icon: "⛔",
      action: async (id: string) => {
        const result = await bulkSuspendShops([id]);
        return { success: result.successCount > 0, error: result.errors.join(", ") || undefined };
      },
      successMessage: "{count} shop(s) suspended",
      errorMessage: "Failed to suspend shops",
      confirmMessage: "Suspend {count} shop(s)? They won't receive new orders.",
      variant: "destructive",
      available: (items) => items.some(s => s.status === "active"),
    },
    {
      label: "Activate",
      icon: "✅",
      action: async (id: string) => {
        const result = await bulkActivateShops([id]);
        return { success: result.successCount > 0, error: result.errors.join(", ") || undefined };
      },
      successMessage: "{count} shop(s) activated",
      errorMessage: "Failed to activate shops",
      confirmMessage: "Activate {count} suspended shop(s)?",
      variant: "default",
      available: (items) => items.some(s => s.status === "suspended"),
    },
  ]);

  // Filter available actions based on selected items
  const availableActions = configs
    .map((config, index) => ({ config, index }))
    .filter(({ config }) => config.available?.(shops.filter(s => selectedIds.has(s.id))) ?? true)
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
        {shops.length === 0 ? (
          <div className="py-12 text-center">
            <span className="text-4xl" aria-hidden="true">{tab === "pending" ? "📭" : "🏪"}</span>
            <h3 className="mt-2 text-lg font-medium text-gray-900">
              {tab === "pending" ? "No pending applications" : "No shops yet"}
            </h3>
            <p className="mt-1 text-gray-500">
              {tab === "pending"
                ? "New shop applications will appear here"
                : "Approved shops will appear here"}
            </p>
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
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Shop</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Owner</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Applied</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shops.map((shop) => {
                  const owner = shop.owner_id ? owners.get(shop.owner_id) : null;
                  const statusConfig = SHOP_STATUS_CONFIG[shop.status];
                  const isSelected = selectedIds.has(shop.id);

                  return (
                    <tr 
                      key={shop.id} 
                      className={`hover:bg-gray-50 ${isSelected ? "bg-orange-50" : ""}`}
                    >
                      <td className="px-6 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(shop.id)}
                          className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                          aria-label={isSelected ? "Deselect" : "Select"}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/shops/${shop.id}`}
                          className="font-medium text-gray-900 hover:text-orange-600"
                        >
                          {shop.name}
                        </Link>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {shop.phone || "No phone"} · {shop.email || "No email"}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        {owner ? (
                          <div>
                            <p className="text-sm font-medium text-gray-900">{owner.full_name}</p>
                            <p className="text-sm text-gray-500">{owner.phone || "No phone"}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">Owner not linked</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">
                          {shop.address_line}, {shop.city}
                        </p>
                        <p className="text-sm text-gray-500">
                          {shop.district} · {shop.province}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.className}`}>
                          {statusConfig.icon && <span aria-hidden="true" className="mr-1">{statusConfig.icon}</span>}
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(shop.created_at).toLocaleDateString("en-NP", {
                          dateStyle: "medium",
                          timeZone: "Asia/Kathmandu",
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/shops/${shop.id}`}
                            className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                          >
                            View
                          </Link>
                          
                          {shop.status === "pending" && (
                            <>
                              <button
                                onClick={() => onApprove(shop.id)}
                                className="text-sm text-green-600 hover:text-green-700 font-medium"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => onReject(shop.id)}
                                className="text-sm text-red-600 hover:text-red-700 font-medium"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          
                          {shop.status === "active" && (
                            <button
                              onClick={() => onSuspend(shop.id)}
                              className="text-sm text-red-600 hover:text-red-700 font-medium"
                            >
                              Suspend
                            </button>
                          )}
                          
                          {shop.status === "suspended" && (
                            <button
                              onClick={() => onActivate(shop.id)}
                              className="text-sm text-green-600 hover:text-green-700 font-medium"
                            >
                              Activate
                            </button>
                          )}
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

      {/* Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selectedCount}
        totalCount={shops.length}
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

export default function ShopsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get("tab") || "all";
  
  const [shops, setShops] = useState<Shop[]>([]);
  const [owners, setOwners] = useState<Map<string, Owner>>(new Map());
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    try {
      const supabase = createClient();
      
      let query = supabase
        .from("vendors")
        .select("id, name, phone, email, address_line, city, district, province, description, status, owner_id, created_at, approved_at, rejected_at, rejection_reason, gst_number, pan_number, bank_account, bank_ifsc")
        .order("created_at", { ascending: false });

      if (tab === "pending") {
        query = query.eq("status", "pending");
      }

      const { data: shopsData, error: shopsError } = await query.limit(100);
      if (!shopsError) {
        const shopsArray = (shopsData as Shop[]) ?? [];
        setShops(shopsArray);
        
        const ownerIds = shopsArray
          .map(s => s.owner_id)
          .filter((id): id is string => id !== null && id !== undefined);
        if (ownerIds.length > 0) {
          const { data: ownersData, error: ownersError } = await supabase
            .from("profiles")
            .select("id, full_name, phone")
            .in("id", ownerIds);
          if (!ownersError && ownersData) {
            setOwners(new Map(ownersData.map(p => [p.id, p])));
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch shops:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [tab]);

  async function handleApprove(id: string) {
    try {
      await approveShop(id);
      setShops(prev => prev.map(s => s.id === id ? { ...s, status: "active" as const } : s));
    } catch (error) {
      console.error("Failed to approve shop:", error);
    }
  }

  async function handleReject(id: string) {
    try {
      await rejectShop(id);
      setShops(prev => prev.map(s => s.id === id ? { ...s, status: "rejected" as const } : s));
    } catch (error) {
      console.error("Failed to reject shop:", error);
    }
  }

  async function handleSuspend(id: string) {
    try {
      await suspendShop(id);
      setShops(prev => prev.map(s => s.id === id ? { ...s, status: "suspended" as const } : s));
    } catch (error) {
      console.error("Failed to suspend shop:", error);
    }
  }

  async function handleActivate(id: string) {
    try {
      await activateShop(id);
      setShops(prev => prev.map(s => s.id === id ? { ...s, status: "active" as const } : s));
    } catch (error) {
      console.error("Failed to activate shop:", error);
    }
  }

  const tabs = [
    { value: "all", label: "All Shops", count: shops.length },
    { value: "pending", label: "Pending Review", count: shops.filter(s => s.status === "pending").length },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shops</h1>
            <p className="text-gray-600 mt-1">Manage hardware shop applications and accounts</p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto" />
            <p className="mt-2 text-gray-600">Loading shops...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shops</h1>
          <p className="text-gray-600 mt-1">Manage hardware shop applications and accounts</p>
        </div>
        <div className="flex gap-3">
          <ExportButton
            data={shops}
            apiUrl="/api/admin/export/shops"
            filename={`shops_${tab}`}
            label="Export"
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
            variant="outline"
          />
        </div>
      </div>

      {/* Tabs */}
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
              router.push(`/admin/shops?${params.toString()}`);
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

      <ShopsTable 
        shops={shops} 
        owners={owners} 
        tab={tab}
        onApprove={handleApprove}
        onReject={handleReject}
        onSuspend={handleSuspend}
        onActivate={handleActivate}
      />
    </div>
  );
}
