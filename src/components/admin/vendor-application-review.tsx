"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function VendorApplicationReview({ vendorId, shopName }: { vendorId: string; shopName: string }) {
  const router = useRouter();
  const [commissionPercent, setCommissionPercent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function review(decision: "active" | "rejected", event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedPercent = Number(commissionPercent);
    if (decision === "active" && (!commissionPercent || !Number.isFinite(parsedPercent) || parsedPercent < 0 || parsedPercent >= 100)) {
      setMessage("Enter the agreed commission rate from 0% up to but not including 100% before approving.");
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      const { error } = await createClient().rpc("review_vendor_application", {
        p_vendor_id: vendorId,
        p_decision: decision,
        p_commission_rate: decision === "active" ? parsedPercent / 100 : null,
      });
      if (error) throw error;
      setMessage(decision === "active" ? `${shopName} is approved and active.` : `${shopName} was rejected.`);
      router.refresh();
    } catch (error) {
      console.error("Shop application review failed:", error);
      setMessage("The application could not be reviewed. Refresh the page and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-review-controls">
      <form onSubmit={(event) => review("active", event)}>
        <label>Agreed platform commission<input type="number" min="0" max="99.99" step="0.01" inputMode="decimal" value={commissionPercent} onChange={(event) => setCommissionPercent(event.target.value)} placeholder="Enter %" required /><span>%</span></label>
        <button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Approve shop"}</button>
      </form>
      <form onSubmit={(event) => review("rejected", event)}><button className="admin-reject-button" type="submit" disabled={submitting}>{submitting ? "Saving…" : "Reject application"}</button></form>
      {message ? <p role="status" className="admin-review-message">{message}</p> : null}
    </div>
  );
}
