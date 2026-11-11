"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function recordPayout(commissionId: string, payoutReference: string) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  
  if (profile?.role !== "admin") throw new Error("Forbidden");

  const { error } = await supabase
    .from("commissions")
    .update({ 
      status: "paid", 
      payout_reference: payoutReference,
      paid_at: new Date().toISOString()
    })
    .eq("id", commissionId);

  if (error) throw error;

  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  
  return { success: true };
}

export async function recordCashCollection(paymentId: string, orderId: string) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  
  if (profile?.role !== "admin") throw new Error("Forbidden");

  const { error } = await supabase
    .from("payments")
    .update({ 
      status: "collected",
      cash_collected_at: new Date().toISOString()
    })
    .eq("order_id", orderId);

  if (error) throw error;

  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  
  return { success: true };
}
