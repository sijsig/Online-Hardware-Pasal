import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { searchParams } = new URL(request.url);
    const parentOnly = searchParams.get("parent_only") === "true";
    
    let query = supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    
    if (parentOnly) {
      query = query.is("parent_id", null);
    }
    
    const { data: categories, error } = await query;
    
    if (error) throw error;
    
    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Categories API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
