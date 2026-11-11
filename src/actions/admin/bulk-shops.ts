"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface BulkResult {
  successCount: number;
  errorCount: number;
  errors: string[];
}

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  
  if (profile?.role !== "admin") throw new Error("Forbidden");
  
  return supabase;
}

export async function bulkApproveShops(vendorIds: string[]): Promise<BulkResult> {
  const supabase = await verifyAdmin();
  const result: BulkResult = { successCount: 0, errorCount: 0, errors: [] };

  for (const vendorId of vendorIds) {
    try {
      const { error } = await supabase
        .from("vendors")
        .update({ status: "active", approved_at: new Date().toISOString() })
        .eq("id", vendorId);

      if (error) throw error;
      result.successCount++;
    } catch (err) {
      result.errorCount++;
      result.errors.push(`${vendorId}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/admin/shops");
    revalidatePath("/admin");
  }

  return result;
}

export async function bulkRejectShops(vendorIds: string[], reason?: string): Promise<BulkResult> {
  const supabase = await verifyAdmin();
  const result: BulkResult = { successCount: 0, errorCount: 0, errors: [] };

  for (const vendorId of vendorIds) {
    try {
      const { error } = await supabase
        .from("vendors")
        .update({ 
          status: "rejected", 
          rejection_reason: reason || "Bulk rejection",
          rejected_at: new Date().toISOString() 
        })
        .eq("id", vendorId);

      if (error) throw error;
      result.successCount++;
    } catch (err) {
      result.errorCount++;
      result.errors.push(`${vendorId}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/admin/shops");
    revalidatePath("/admin");
  }

  return result;
}

export async function bulkSuspendShops(vendorIds: string[]): Promise<BulkResult> {
  const supabase = await verifyAdmin();
  const result: BulkResult = { successCount: 0, errorCount: 0, errors: [] };

  for (const vendorId of vendorIds) {
    try {
      const { error } = await supabase
        .from("vendors")
        .update({ status: "suspended", suspended_at: new Date().toISOString() })
        .eq("id", vendorId);

      if (error) throw error;
      result.successCount++;
    } catch (err) {
      result.errorCount++;
      result.errors.push(`${vendorId}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/admin/shops");
    revalidatePath("/admin");
  }

  return result;
}

export async function bulkActivateShops(vendorIds: string[]): Promise<BulkResult> {
  const supabase = await verifyAdmin();
  const result: BulkResult = { successCount: 0, errorCount: 0, errors: [] };

  for (const vendorId of vendorIds) {
    try {
      const { error } = await supabase
        .from("vendors")
        .update({ status: "active", suspended_at: null })
        .eq("id", vendorId);

      if (error) throw error;
      result.successCount++;
    } catch (err) {
      result.errorCount++;
      result.errors.push(`${vendorId}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/admin/shops");
    revalidatePath("/admin");
  }

  return result;
}
