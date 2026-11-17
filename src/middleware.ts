import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request);

  // Refresh session if expired - required for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Skip API routes - let them handle their own auth
  if (pathname.startsWith("/api/")) {
    return response;
  }

  // Protect admin routes
  if (pathname.startsWith("/admin")) {
    if (!user) {
      // Redirect to login with redirect back to admin
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Check if user has admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin" && profile?.role !== "super_admin") {
      // Redirect to unauthorized page or home
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  // Protect vendor routes
  if (pathname.startsWith("/vendor")) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Check if user has vendor role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "vendor_owner" && profile?.role !== "vendor_staff" && profile?.role !== "admin" && profile?.role !== "super_admin") {
      // User is authenticated but not a vendor - show vendor application page
      // The Server Component will handle this, but we allow the request through
    }
  }

  // Protect rider routes
  if (pathname.startsWith("/rider")) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Protect customer account/cart/checkout routes
  if (pathname.startsWith("/cart") || pathname.startsWith("/checkout") || pathname.startsWith("/account") || pathname.startsWith("/orders")) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/vendor/:path*",
    "/rider/:path*",
    "/cart/:path*",
    "/checkout/:path*",
    "/account/:path*",
    "/orders/:path*",
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
