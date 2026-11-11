"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function approveProduct(submissionId: string) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  
  if (profile?.role !== "admin") throw new Error("Forbidden");

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

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/pending");
  revalidatePath("/admin");
  
  return { success: true };
}

export async function rejectProduct(submissionId: string, reason?: string) {
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
    .from("vendor_product_submissions")
    .update({ status: "rejected", rejection_reason: reason, reviewed_at: new Date().toISOString() })
    .eq("id", submissionId);

  if (error) throw error;

  revalidatePath("/admin/products/pending");
  revalidatePath("/admin");
  
  return { success: true };
}

export async function updateProductStatus(productId: string, isActive: boolean) {
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
    .from("products")
    .update({ is_active: isActive })
    .eq("id", productId);

  if (error) throw error;

  revalidatePath("/admin/products");
  revalidatePath("/admin");
  
  return { success: true };
}
