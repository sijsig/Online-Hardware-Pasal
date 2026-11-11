"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RecordPayout({ commissionId }: { commissionId: string }) {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const { error } = await createClient().rpc("admin_record_vendor_payout", { p_commission_id: commissionId, p_reference: reference.trim() });
      if (error) throw error;
      setMessage("Payout recorded.");
      router.refresh();
    } catch (error) {
      console.error("Vendor payout record failed:", error);
      setMessage("Could not record this payout. Check the reference and try again.");
    } finally { setSaving(false); }
  }

  return <form className="admin-payout-form" onSubmit={submit}><input aria-label="Vendor payout reference" value={reference} onChange={(event) => setReference(event.target.value)} minLength={3} maxLength={120} placeholder="Bank / wallet reference" required /><button type="submit" disabled={saving}>{saving ? "Saving…" : "Record paid"}</button>{message ? <span role="status">{message}</span> : null}</form>;
}
