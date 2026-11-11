import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  // Check admin auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30");
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    const { data: orders } = await supabase
      .from("orders")
      .select("created_at, total")
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: true });

    // Aggregate by date
    const dailyData = new Map<string, { orders: number; revenue: number }>();
    
    (orders || []).forEach(order => {
      const date = order.created_at.split("T")[0];
      const existing = dailyData.get(date) || { orders: 0, revenue: 0 };
      existing.orders += 1;
      existing.revenue += Number(order.total);
      dailyData.set(date, existing);
    });

    // Fill missing dates with zeros
    const result = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split("T")[0];
      const data = dailyData.get(dateStr) || { orders: 0, revenue: 0 };
      result.push({ date: dateStr, ...data });
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Orders trend error:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
