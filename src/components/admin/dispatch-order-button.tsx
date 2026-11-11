"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DispatchOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function dispatch() {
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await createClient().rpc("dispatch_confirmed_order", { p_order_id: orderId });
      if (error) throw error;
      setMessage(data ? "Rider offer created." : "No eligible online rider found yet.");
      router.refresh();
    } catch (error) {
      console.error("Manual rider dispatch failed:", error);
      setMessage("Could not dispatch this order. Refresh and try again.");
    } finally { setBusy(false); }
  }

  return <div className="admin-dispatch-action"><button type="button" disabled={busy} onClick={() => void dispatch()}>{busy ? "Finding rider…" : "Find nearby rider"}</button>{message ? <span role="status">{message}</span> : null}</div>;
}
