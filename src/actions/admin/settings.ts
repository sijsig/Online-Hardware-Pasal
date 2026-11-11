"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/* ============================================================
   Types
   ============================================================ */

export type AdminSetting = {
  id: string;
  key: string;
  value: any;
  description: string | null;
  category: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type FeatureFlag = {
  id: string;
  key: string;
  enabled: boolean;
  description: string | null;
  rollout_percentage: number;
  target_roles: string[];
  created_at: string;
  updated_at: string;
};

/* ============================================================
   Admin Settings Actions
   ============================================================ */

export async function getAdminSettings(category?: string) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  
  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    throw new Error("Forbidden");
  }

  let query = supabase
    .from("admin_settings")
    .select("*")
    .order("category")
    .order("key");

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as AdminSetting[]) ?? [];
}

export async function getPublicSettings() {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("admin_settings")
    .select("key, value")
    .eq("is_public", true);
  
  if (error) throw error;
  return (data as { key: string; value: any }[]) ?? [];
}

export async function updateAdminSetting(key: string, value: any) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  
  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    throw new Error("Forbidden");
  }

  const { error } = await supabase
    .from("admin_settings")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", key);

  if (error) throw error;

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function bulkUpdateAdminSettings(settings: { key: string; value: any }[]) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  
  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    throw new Error("Forbidden");
  }

  const updates = settings.map(({ key, value }) => 
    supabase
      .from("admin_settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", key)
  );

  const results = await Promise.all(updates);
  
  for (const result of results) {
    if (result.error) throw result.error;
  }

  revalidatePath("/admin/settings");
  return { success: true };
}

/* ============================================================
   Feature Flags Actions
   ============================================================ */

export async function getFeatureFlags() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  
  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    throw new Error("Forbidden");
  }

  const { data, error } = await supabase
    .from("feature_flags")
    .select("*")
    .order("key");

  if (error) throw error;
  return (data as FeatureFlag[]) ?? [];
}

export async function getPublicFeatureFlags() {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("feature_flags")
    .select("key, enabled")
    .eq("enabled", true);
  
  if (error) throw error;
  return (data as { key: string; enabled: boolean }[]) ?? [];
}

export async function updateFeatureFlag(key: string, enabled: boolean, options?: { rollout_percentage?: number; target_roles?: string[] }) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  
  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    throw new Error("Forbidden");
  }

  const updateData: any = { enabled, updated_at: new Date().toISOString() };
  if (options?.rollout_percentage !== undefined) updateData.rollout_percentage = options.rollout_percentage;
  if (options?.target_roles !== undefined) updateData.target_roles = options.target_roles;

  const { error } = await supabase
    .from("feature_flags")
    .update(updateData)
    .eq("key", key);

  if (error) throw error;

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function bulkUpdateFeatureFlags(flags: { key: string; enabled: boolean }[]) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  
  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    throw new Error("Forbidden");
  }

  const updates = flags.map(({ key, enabled }) => 
    supabase
      .from("feature_flags")
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq("key", key)
  );

  const results = await Promise.all(updates);
  
  for (const result of results) {
    if (result.error) throw result.error;
  }

  revalidatePath("/admin/settings");
  return { success: true };
}

/* ============================================================
   Utility: Check if feature is enabled (for client-side use)
   ============================================================ */

export async function isFeatureEnabled(key: string, userId?: string): Promise<boolean> {
  const supabase = await createClient();
  
  const { data: flag } = await supabase
    .from("feature_flags")
    .select("enabled, rollout_percentage, target_roles")
    .eq("key", key)
    .maybeSingle();
  
  if (!flag) return false;
  if (!flag.enabled) return false;
  
  // Check rollout percentage
  if (flag.rollout_percentage < 100) {
    // Simple hash-based rollout (in production, use consistent hashing)
    const hash = userId ? hashString(userId) : Math.random() * 100;
    if (hash >= flag.rollout_percentage) return false;
  }
  
  // Check target roles
  if (flag.target_roles && flag.target_roles.length > 0 && userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    
    if (!profile || !flag.target_roles.includes(profile.role)) {
      return false;
    }
  }
  
  return true;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % 100;
}
