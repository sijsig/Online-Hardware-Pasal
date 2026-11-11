"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function VendorStatusAction({ vendorId, status }: { vendorId: string; status: "active" | "suspended" }) {
  return <StatusButton label={status === "active" ? "Suspend shop" : "Reactivate shop"} rpc="admin_set_vendor_status" args={{ p_vendor_id: vendorId, p_status: status === "active" ? "suspended" : "active" }} />;
}

export function RiderStatusAction({ riderId, status }: { riderId: string; status: "offline" | "available" | "busy" | "suspended" }) {
  const next = status === "suspended" ? "offline" : "suspended";
  return <StatusButton label={status === "suspended" ? "Reinstate" : "Suspend rider"} rpc="admin_set_rider_status" args={{ p_rider_id: riderId, p_status: next }} />;
}

function StatusButton({ label, rpc, args }: { label: string; rpc: "admin_set_vendor_status" | "admin_set_rider_status"; args: Record<string, string> }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function update() {
    setSaving(true); setMessage("");
    try {
      const { error } = await createClient().rpc(rpc, args);
      if (error) throw error;
      setMessage("Updated"); router.refresh();
    } catch (error) {
      console.error("Admin status update failed:", error);
      setMessage("Could not update");
    } finally { setSaving(false); }
  }

  return <div className="admin-account-action"><button className={label.startsWith("Suspend") ? "admin-reject-button" : ""} type="button" disabled={saving} onClick={() => void update()}>{saving ? "Saving…" : label}</button>{message ? <span role="status">{message}</span> : null}</div>;
}
