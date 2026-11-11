import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const body = await request.json();
    const { email, password, full_name, phone, role = "customer" } = body;
    
    if (!email || !password || !full_name) {
      return NextResponse.json(
        { success: false, error: "Email, password, and full name required" },
        { status: 400 }
      );
    }
    
    // Validate role
    const validRoles = ["customer", "vendor", "rider"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: "Invalid role" },
        { status: 400 }
      );
    }
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          role,
          phone,
        },
      },
    });
    
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    
    // Profile is created via trigger, but we can also create it here if needed
    if (data.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: data.user.id,
          email: data.user.email,
          full_name,
          role,
          phone,
        });
      
      if (profileError) {
        console.error("Profile creation error:", profileError);
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        user: data.user,
        session: data.session,
        message: "Please check your email to confirm your account",
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { success: false, error: "Signup failed" },
      { status: 500 }
    );
  }
}
