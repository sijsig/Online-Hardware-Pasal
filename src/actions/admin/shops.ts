"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function approveShop(vendorId: string) {
  const supabase = await createClient();
  
  // Check admin auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  
  if (profile?.role !== "admin") throw new Error("Forbidden");

  // Update vendor status
  const { error } = await supabase
    .from("vendors")
    .update({ status: "active", approved_at: new Date().toISOString() })
    .eq("id", vendorId);

  if (error) throw error;

  // Notify vendor (could add notification table insert here)
  revalidatePath("/admin/shops");
  revalidatePath("/admin");
  
  return { success: true };
}

export async function rejectShop(vendorId: string, reason?: string) {
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
    .from("vendors")
    .update({ status: "rejected", rejection_reason: reason, rejected_at: new Date().toISOString() })
    .eq("id", vendorId);

  if (error) throw error;

  revalidatePath("/admin/shops");
  revalidatePath("/admin");
  
  return { success: true };
}

export async function suspendShop(vendorId: string) {
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
    .from("vendors")
    .update({ status: "suspended", suspended_at: new Date().toISOString() })
    .eq("id", vendorId);

  if (error) throw error;

  revalidatePath("/admin/shops");
  revalidatePath("/admin");
  
  return { success: true };
}

export async function activateShop(vendorId: string) {
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
    .from("vendors")
    .update({ status: "active", suspended_at: null })
    .eq("id", vendorId);

  if (error) throw error;

  revalidatePath("/admin/shops");
  revalidatePath("/admin");
  
  return { success: true };
}

// Form action wrappers for use in HTML forms - return void for form actions
export async function approveShopAction(formData: FormData): Promise<void> {
  const vendorId = formData.get("vendorId") as string;
  await approveShop(vendorId);
}

export async function rejectShopAction(formData: FormData): Promise<void> {
  const vendorId = formData.get("vendorId") as string;
  const reason = formData.get("reason") as string | undefined;
  await rejectShop(vendorId, reason);
}

export async function suspendShopAction(formData: FormData): Promise<void> {
  const vendorId = formData.get("vendorId") as string;
  await suspendShop(vendorId);
}

export async function activateShopAction(formData: FormData): Promise<void> {
  const vendorId = formData.get("vendorId") as string;
  await activateShop(vendorId);
}
