import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/customer/sign-out-button";
import { CommandPalette } from "@/components/admin/command-palette";
import { RealtimeIndicator, RealtimeNotifications } from "@/components/admin/realtime-indicator";
import { ADMIN_NAVIGATION } from "@/types/admin";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "@/components/admin/theme-provider";
import { ThemeToggleCompact } from "@/components/admin/theme-toggle";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=%2Fadmin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/");
  }

  return (
    <ThemeProvider>
      <div className="admin-layout min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Toaster for notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { background: "#363636", color: "#fff" },
            success: { iconTheme: { primary: "#10b981", secondary: "#fff" } },
            error: { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
          }}
        />

        {/* Command Palette */}
        <CommandPalette />

        {/* Realtime Notifications */}
        <RealtimeNotifications />

        {/* Sidebar */}
        <aside className="admin-sidebar fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 hidden lg:block">
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="text-xl font-bold text-gray-900 dark:text-white">H</span>
              <span className="font-semibold text-gray-700 dark:text-gray-200">hardware<span className="text-orange-600">pasal</span></span>
            </Link>
          </div>
          <nav className="p-4 space-y-1" aria-label="Admin navigation">
            {ADMIN_NAVIGATION.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <span aria-hidden="true" className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700">
            <SignOutButton />
          </div>
        </aside>

        {/* Mobile sidebar toggle */}
        <button
          className="lg:hidden fixed top-4 left-4 z-50 rounded-lg bg-white dark:bg-gray-800 p-2 shadow-md border border-gray-200 dark:border-gray-700"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Main content */}
        <main className="admin-main lg:ml-64 min-h-screen">
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Admin</h1>
              <RealtimeIndicator />
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="hidden sm:block text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                View marketplace
              </Link>
              <ThemeToggleCompact />
              <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-gray-50 dark:bg-gray-800">
                <span className="text-sm text-gray-600 dark:text-gray-400">{profile?.full_name || "Admin"}</span>
                <SignOutButton />
              </div>
            </div>
          </header>

          {/* Page content */}
          <div className="p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </ThemeProvider>
  );
}
