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

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "10");

  try {
    // Get orders with vendor info
    const { data: orders } = await supabase
      .from("orders")
      .select("vendor_id, total, status")
      .eq("status", "delivered");

    const vendorStats = new Map<string, { orders: number; revenue: number }>();
    (orders || []).forEach(order => {
      const existing = vendorStats.get(order.vendor_id) || { orders: 0, revenue: 0 };
      existing.orders += 1;
      existing.revenue += Number(order.total);
      vendorStats.set(order.vendor_id, existing);
    });

    // Get vendor names
    const vendorIds = Array.from(vendorStats.keys());
    const { data: vendors } = await supabase
      .from("vendors")
      .select("id, name")
      .in("id", vendorIds);

    const vendorNames = new Map((vendors || []).map(v => [v.id, v.name]));

    const result = Array.from(vendorStats.entries())
      .map(([vendorId, stats]) => ({
        name: vendorNames.get(vendorId) || `Shop ${vendorId.slice(0, 8)}`,
        ...stats,
      }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, limit);

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
