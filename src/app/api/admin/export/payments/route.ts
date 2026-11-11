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
  const isExport = searchParams.get("export") === "true";

  try {
    const [payments, commissions] = await Promise.all([
      supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("commissions")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    const data = {
      payments: payments.data || [],
      commissions: commissions.data || [],
    };

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
