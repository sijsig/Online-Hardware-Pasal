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

export async function bulkApproveProducts(submissionIds: string[]): Promise<BulkResult> {
  const supabase = await verifyAdmin();
  const result: BulkResult = { successCount: 0, errorCount: 0, errors: [] };

  for (const submissionId of submissionIds) {
    try {
      // Get the submission first
      const { data: submission } = await supabase
        .from("vendor_product_submissions")
        .select("*")
        .eq("id", submissionId)
        .maybeSingle();

      if (!submission) throw new Error("Submission not found");

      // If there's already a product_id, update it; otherwise create new product
      if (submission.product_id) {
        const { error } = await supabase
          .from("products")
          .update({ is_active: true })
          .eq("id", submission.product_id);
        if (error) throw error;
      } else {
        // Create new catalog product
        const { data: product, error } = await supabase
          .from("products")
          .insert({
            category_id: submission.category_id,
            name: submission.product_name,
            slug: submission.product_name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            brand: submission.brand,
            model: submission.model,
            unit: submission.unit,
            price: submission.price,
            stock_quantity: submission.stock_quantity,
            is_active: true,
            vendor_id: submission.vendor_id,
          })
          .select()
          .single();
        
        if (error) throw error;

        // Update submission with product_id
        await supabase
          .from("vendor_product_submissions")
          .update({ product_id: product.id })
          .eq("id", submissionId);
      }

      // Mark submission as approved
      const { error } = await supabase
        .from("vendor_product_submissions")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", submissionId);

      if (error) throw error;
      result.successCount++;
    } catch (err) {
      result.errorCount++;
      result.errors.push(`${submissionId}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/admin/products");
    revalidatePath("/admin/products/pending");
    revalidatePath("/admin");
  }

  return result;
}

export async function bulkRejectProducts(submissionIds: string[], reason?: string): Promise<BulkResult> {
  const supabase = await verifyAdmin();
  const result: BulkResult = { successCount: 0, errorCount: 0, errors: [] };

  for (const submissionId of submissionIds) {
    try {
      const { error } = await supabase
        .from("vendor_product_submissions")
        .update({ status: "rejected", rejection_reason: reason, reviewed_at: new Date().toISOString() })
        .eq("id", submissionId);

      if (error) throw error;
      result.successCount++;
    } catch (err) {
      result.errorCount++;
      result.errors.push(`${submissionId}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/admin/products/pending");
    revalidatePath("/admin");
  }

  return result;
}

export async function bulkToggleProductStatus(productIds: string[], isActive: boolean): Promise<BulkResult> {
  const supabase = await verifyAdmin();
  const result: BulkResult = { successCount: 0, errorCount: 0, errors: [] };

  for (const productId of productIds) {
    try {
      const { error } = await supabase
        .from("products")
        .update({ is_active: isActive })
        .eq("id", productId);

      if (error) throw error;
      result.successCount++;
    } catch (err) {
      result.errorCount++;
      result.errors.push(`${productId}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/admin/products");
    revalidatePath("/admin");
  }

  return result;
}
