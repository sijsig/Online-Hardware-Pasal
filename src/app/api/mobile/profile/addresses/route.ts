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
    
    const { data: addresses } = await supabase
      .from("customer_addresses")
      .select("id, label, address_line, city, district, province, location, is_default, created_at")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false });
    
    return NextResponse.json({
      success: true,
      data: addresses || [],
    });
  } catch (error) {
    console.error("Addresses GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch addresses" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
    const { label, address_line, city, district, province, lat, lng, is_default } = body;
    
    if (!label || !address_line || !city) {
      return NextResponse.json(
        { success: false, error: "Label, address line, and city required" },
        { status: 400 }
      );
    }
    
    // If this is default, unset other defaults
    if (is_default) {
      await supabase
        .from("customer_addresses")
        .update({ is_default: false })
        .eq("user_id", user.id);
    }
    
    const location = lat && lng 
      ? `POINT(${lng} ${lat})` 
      : null;
    
    const { data: address, error } = await supabase
      .from("customer_addresses")
      .insert({
        user_id: user.id,
        label,
        address_line,
        city,
        district,
        province,
        location,
        is_default: is_default || false,
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({
      success: true,
      data: address,
    });
  } catch (error) {
    console.error("Addresses POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create address" },
      { status: 500 }
    );
  }
}
