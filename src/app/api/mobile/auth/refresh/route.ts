import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const body = await request.json();
    const { refresh_token } = body;
    
    if (!refresh_token) {
      return NextResponse.json(
        { success: false, error: "Refresh token required" },
        { status: 400 }
      );
    }
    
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token,
    });
    
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 }
      );
    }
    
    if (!data.session) {
      return NextResponse.json(
        { success: false, error: "No session returned" },
        { status: 401 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
      },
    });
  } catch (error) {
    console.error("Refresh error:", error);
    return NextResponse.json(
      { success: false, error: "Token refresh failed" },
      { status: 500 }
    );
  }
}
