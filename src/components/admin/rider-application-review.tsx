"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RiderApplicationReview({ riderId }: { riderId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function review(decision: "approved" | "rejected") {
    setSaving(true);
    setMessage("");
    try {
      const { error } = await createClient().rpc("review_rider_application", { p_rider_id: riderId, p_decision: decision });
      if (error) throw error;
      setMessage(decision === "approved" ? "Approved" : "Rejected");
      router.refresh();
    } catch (error) {
      console.error("Rider application review failed:", error);
      setMessage("Could not save. Refresh and retry.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="admin-rider-actions"><button type="button" disabled={saving} onClick={() => void review("approved")}>{saving ? "Saving…" : "Approve"}</button><button className="admin-reject-button" type="button" disabled={saving} onClick={() => void review("rejected")}>Reject</button>{message ? <span role="status">{message}</span> : null}</div>;
}
