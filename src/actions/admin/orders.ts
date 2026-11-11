"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateOrderStatus(orderId: string, status: string) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  
  if (profile?.role !== "admin") throw new Error("Forbidden");

  const updateData: Record<string, string> = { status };
  
  if (status === "confirmed") updateData.confirmed_at = new Date().toISOString();
  if (status === "delivered") updateData.delivered_at = new Date().toISOString();

  const { error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", orderId);

  if (error) throw error;

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");
  
  return { success: true };
}

export async function dispatchOrder(orderId: string) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  
  if (profile?.role !== "admin") throw new Error("Forbidden");

  // Find available riders
  const { data: riders } = await supabase
    .from("riders")
    .select("user_id")
    .eq("application_status", "approved")
    .eq("status", "available")
    .limit(5);

  if (!riders || riders.length === 0) {
    throw new Error("No available riders found");
  }

  // Create delivery assignment (offer to first available rider)
  const { error } = await supabase
    .from("delivery_assignments")
    .insert({
      order_id: orderId,
      rider_id: riders[0].user_id,
      status: "offered",
    });

  if (error) throw error;

  // Update order status
  await supabase
    .from("orders")
    .update({ status: "delivering" })
    .eq("id", orderId);

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");
  
  return { success: true };
}
