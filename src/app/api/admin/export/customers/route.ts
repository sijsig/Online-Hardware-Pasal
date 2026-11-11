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
    let query = supabase
      .from("profiles")
      .select("id, full_name, phone, email, role, created_at")
      .eq("role", "customer")
      .order("created_at", { ascending: false });

    if (!isExport) {
      query = query.limit(100);
    }

    const { data } = await query;
    return NextResponse.json({ data: data || [] });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
