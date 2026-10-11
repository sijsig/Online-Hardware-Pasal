import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(path: string | null) {
  return path && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\")
    ? path
    : "/account";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));
  const providerError = request.nextUrl.searchParams.get("error");

  if (code && !providerError) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(nextPath, request.url));
    } catch (error) {
      // Do not log the callback URL, code, cookies, or session tokens.
      console.error("Supabase auth callback failed:", error instanceof Error ? error.message : "Unknown error");
    }
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", "auth_callback");
  loginUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(loginUrl);
}
