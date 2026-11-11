import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, phone, avatar_url, created_at")
      .eq("id", user.id)
      .single();
    
    // Get addresses
    const { data: addresses } = await supabase
      .from("customer_addresses")
      .select("id, label, address_line, city, district, province, location, is_default")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false });
    
    // Get order count
    const { count: orderCount } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", user.id);
    
    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          ...profile,
        },
        addresses: addresses || [],
        stats: {
          totalOrders: orderCount || 0,
        },
      },
    });
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { full_name, phone, avatar_url } = body;
    
    const updates: any = {};
    if (full_name) updates.full_name = full_name;
    if (phone) updates.phone = phone;
    if (avatar_url) updates.avatar_url = avatar_url;
    
    const { data: profile, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({
      success: true,
      data: { ...user, ...profile },
    });
  } catch (error) {
    console.error("Profile PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
