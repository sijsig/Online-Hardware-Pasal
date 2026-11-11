"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type PendingVendorProduct = {
  id: string;
  vendor_id: string;
  product_id: string | null;
  category_name: string;
  product_name: string;
  brand: string | null;
  model: string | null;
  unit: string;
  price: number | string;
  stock_quantity: number;
  vendor_sku: string | null;
  created_at: string;
  vendor_name: string;
};

export function VendorProductReview({ submissions }: { submissions: PendingVendorProduct[] }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");

  async function review(submission: PendingVendorProduct, approve: boolean) {
    setSavingId(submission.id); setMessage("");
    try {
      const { error } = await createClient().rpc("admin_review_vendor_product", {
        p_submission_id: submission.id,
        p_approve: approve,
        p_admin_note: note.trim() || null,
      });
      if (error) throw error;
      setNote(""); setMessage(`${submission.product_name} ${approve ? "approved and listed" : "rejected"}.`); router.refresh();
    } catch (error) {
      console.error("Vendor product review failed:", error);
      setMessage("Could not review this product request. Refresh and try again.");
    } finally { setSavingId(""); }
  }

  return <section className="admin-rider-section" id="product-approvals">
    <div className="admin-page-title"><div><p className="section-kicker">Product quality</p><h2>Vendor product approvals</h2><p>Approving adds the catalog item and activates the vendor’s price and stock listing.</p></div><span className="admin-count">{submissions.length} pending</span></div>
    {message && <p className="admin-catalog-message" role="status">{message}</p>}
    {submissions.length ? <div className="admin-application-list">{submissions.map((submission) => <article className="admin-application-card" key={submission.id}>
      <div className="admin-application-heading"><div><p className="section-kicker">{submission.vendor_name} · Submitted {new Date(submission.created_at).toLocaleDateString("en-NP", { dateStyle: "medium" })}</p><h3>{submission.product_name}</h3></div><span className="admin-count">Pending review</span></div>
      <div className="admin-product-review-details"><span>{[submission.category_name, submission.brand, submission.model, `Sold by ${submission.unit}`, submission.vendor_sku ? `SKU ${submission.vendor_sku}` : null].filter(Boolean).join(" · ")}</span><strong>Rs. {Number(submission.price).toLocaleString("en-NP", { maximumFractionDigits: 2 })}</strong><span>{submission.stock_quantity} in stock at this shop</span></div>
      <label className="admin-product-review-note">Admin note <span>Optional; shown to the vendor if rejected</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={2} /></label>
      <div className="admin-product-review-actions"><button type="button" disabled={Boolean(savingId)} onClick={() => void review(submission, true)}>{savingId === submission.id ? "Saving…" : "Approve and list"}</button><button className="admin-reject-button" type="button" disabled={Boolean(savingId)} onClick={() => void review(submission, false)}>Reject</button></div>
    </article>)}</div> : <p className="admin-subtle-empty">No vendor product requests are waiting for review.</p>}
  </section>;
}
