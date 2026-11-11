import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Get today's orders
    const { data: todayOrders } = await supabase
      .from("orders")
      .select("total, commission_amount")
      .gte("created_at", todayISO);

    const todayOrderCount = todayOrders?.length || 0;
    const todayOrderValue = todayOrders?.reduce((sum, o) => sum + Number(o.total), 0) || 0;
    const todayCommission = todayOrders?.reduce((sum, o) => sum + Number(o.commission_amount || 0), 0) || 0;

    // Get pending orders
    const { count: pendingOrders } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    // Get active deliveries
    const { count: activeDeliveries } = await supabase
      .from("delivery_assignments")
      .select("*", { count: "exact", head: true })
      .in("status", ["offered", "accepted", "picked_up"]);

    // Get active vendors
    const { count: activeVendors } = await supabase
      .from("vendors")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    // Get available riders
    const { count: availableRiders } = await supabase
      .from("riders")
      .select("*", { count: "exact", head: true })
      .eq("application_status", "approved")
      .eq("status", "available");

    // Get pending shop applications
    const { count: pendingShopApplications } = await supabase
      .from("vendors")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    // Get pending rider applications
    const { count: pendingRiderApplications } = await supabase
      .from("riders")
      .select("*", { count: "exact", head: true })
      .eq("application_status", "pending");

    return NextResponse.json({
      data: {
        today_orders: todayOrderCount,
        today_order_value: todayOrderValue,
        today_commission: todayCommission,
        active_vendors: activeVendors || 0,
        available_riders: availableRiders || 0,
        pending_orders: pendingOrders || 0,
        active_deliveries: activeDeliveries || 0,
        pending_shop_applications: pendingShopApplications || 0,
        pending_rider_applications: pendingRiderApplications || 0,
      },
    });
  } catch (error) {
    console.error("Metrics error:", error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}
