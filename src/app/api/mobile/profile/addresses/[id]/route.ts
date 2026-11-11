import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const { id } = await params;
    const body = await request.json();
    const { label, address_line, city, district, province, lat, lng, is_default } = body;
    
    // If setting as default, unset other defaults
    if (is_default) {
      await supabase
        .from("customer_addresses")
        .update({ is_default: false })
        .eq("user_id", user.id);
    }
    
    const updates: any = {};
    if (label) updates.label = label;
    if (address_line) updates.address_line = address_line;
    if (city) updates.city = city;
    if (district) updates.district = district;
    if (province) updates.province = province;
    if (is_default !== undefined) updates.is_default = is_default;
    if (lat && lng) {
      updates.location = `POINT(${lng} ${lat})`;
    }
    
    const { data: address, error } = await supabase
      .from("customer_addresses")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();
    
    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { success: false, error: "Address not found" },
          { status: 404 }
        );
      }
      throw error;
    }
    
    return NextResponse.json({
      success: true,
      data: address,
    });
  } catch (error) {
    console.error("Address PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update address" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const { id } = await params;
    
    const { error } = await supabase
      .from("customer_addresses")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Address DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete address" },
      { status: 500 }
    );
  }
}
