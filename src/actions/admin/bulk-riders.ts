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

export async function bulkApproveRiders(userIds: string[]): Promise<BulkResult> {
  const supabase = await verifyAdmin();
  const result: BulkResult = { successCount: 0, errorCount: 0, errors: [] };

  for (const userId of userIds) {
    try {
      const { error } = await supabase
        .from("riders")
        .update({ application_status: "approved", approved_at: new Date().toISOString() })
        .eq("user_id", userId);

      if (error) throw error;
      result.successCount++;
    } catch (err) {
      result.errorCount++;
      result.errors.push(`${userId}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/admin/riders");
    revalidatePath("/admin");
  }

  return result;
}

export async function bulkRejectRiders(userIds: string[]): Promise<BulkResult> {
  const supabase = await verifyAdmin();
  const result: BulkResult = { successCount: 0, errorCount: 0, errors: [] };

  for (const userId of userIds) {
    try {
      const { error } = await supabase
        .from("riders")
        .update({ application_status: "rejected", rejected_at: new Date().toISOString() })
        .eq("user_id", userId);

      if (error) throw error;
      result.successCount++;
    } catch (err) {
      result.errorCount++;
      result.errors.push(`${userId}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/admin/riders");
    revalidatePath("/admin");
  }

  return result;
}

export async function bulkUpdateRiderStatus(
  userIds: string[], 
  status: "offline" | "available" | "busy" | "suspended"
): Promise<BulkResult> {
  const supabase = await verifyAdmin();
  const result: BulkResult = { successCount: 0, errorCount: 0, errors: [] };

  for (const userId of userIds) {
    try {
      const { error } = await supabase
        .from("riders")
        .update({ status })
        .eq("user_id", userId);

      if (error) throw error;
      result.successCount++;
    } catch (err) {
      result.errorCount++;
      result.errors.push(`${userId}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/admin/riders");
    revalidatePath("/admin");
  }

  return result;
}
