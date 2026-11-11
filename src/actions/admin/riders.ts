"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function approveRider(userId: string) {
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
    .from("riders")
    .update({ application_status: "approved", approved_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (error) throw error;

  revalidatePath("/admin/riders");
  revalidatePath("/admin");
  
  return { success: true };
}

export async function rejectRider(userId: string, reason?: string) {
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
    .from("riders")
    .update({ application_status: "rejected", rejected_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (error) throw error;

  revalidatePath("/admin/riders");
  revalidatePath("/admin");
  
  return { success: true };
}

export async function updateRiderStatus(userId: string, status: "offline" | "available" | "busy" | "suspended") {
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
    .from("riders")
    .update({ status })
    .eq("user_id", userId);

  if (error) throw error;

  revalidatePath("/admin/riders");
  revalidatePath("/admin");
  
  return { success: true };
}
