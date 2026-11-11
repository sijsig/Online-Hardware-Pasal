import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#3b82f6",
  preparing: "#8b5cf6",
  delivering: "#f97316",
  delivered: "#10b981",
  cancelled: "#ef4444",
};

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
    const { data: orders } = await supabase
      .from("orders")
      .select("status")
      .order("created_at", { ascending: false });

    const statusCounts = new Map<string, number>();
    (orders || []).forEach(order => {
      statusCounts.set(order.status, (statusCounts.get(order.status) || 0) + 1);
    });

    const result = Array.from(statusCounts.entries())
      .map(([status, count]) => ({
        status: status.charAt(0).toUpperCase() + status.slice(1),
        count,
        color: STATUS_COLORS[status] || "#6b7280",
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
