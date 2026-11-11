import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const radius = parseInt(searchParams.get("radius") || "10000");
    const limit = parseInt(searchParams.get("limit") || "10");
    
    if (!lat || !lng) {
      // Return all active shops if no location provided
      const { data: shops, error } = await supabase
        .from("vendors")
        .select(`
          id, name, slug, description, phone, address_line, city,
          district, province, location, delivery_radius_meters,
          base_delivery_fee, estimated_delivery_minutes,
          commission_rate, rating, total_orders, status, created_at
        `)
        .eq("status", "active")
        .order("rating", { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      return NextResponse.json({ success: true, data: shops || [] });
    }
    
    // Use the findNearestVendor RPC for location-based search
    const { data: nearbyShops, error } = await supabase.rpc("find_nearest_vendors", {
      user_lat: parseFloat(lat),
      user_lng: parseFloat(lng),
      radius_meters: radius,
      limit_count: limit,
    });
    
    if (error) {
      console.error("findNearestVendor error:", error);
      // Fallback to simple query
      const { data: shops, error: fallbackError } = await supabase
        .from("vendors")
        .select(`
          id, name, slug, description, phone, address_line, city,
          district, province, location, delivery_radius_meters,
          base_delivery_fee, estimated_delivery_minutes,
          commission_rate, rating, total_orders, status
        `)
        .eq("status", "active")
        .limit(limit);
      
      if (fallbackError) throw fallbackError;
      
      return NextResponse.json({ success: true, data: shops || [] });
    }
    
    return NextResponse.json({ success: true, data: nearbyShops || [] });
  } catch (error) {
    console.error("Shops API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch shops" },
      { status: 500 }
    );
  }
}
