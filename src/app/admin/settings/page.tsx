import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { 
  getAdminSettings, 
  getFeatureFlags,
  updateAdminSetting,
  updateFeatureFlag,
} from "@/actions/admin/settings";
import { redirect } from "next/navigation";
import { SettingsClient } from "./settings-client";

export const metadata: Metadata = { title: "Settings - Admin", robots: { index: false, follow: false } };

type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
};

type AdminSetting = {
  id: string;
  key: string;
  value: any;
  description: string | null;
  category: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

type FeatureFlag = {
  id: string;
  key: string;
  enabled: boolean;
  description: string | null;
  rollout_percentage: number;
  target_roles: string[];
  created_at: string;
  updated_at: string;
};

async function getAdminUsers() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .in("role", ["admin", "super_admin"])
    .order("created_at", { ascending: false });
  return (data as AdminUser[]) ?? [];
}

export default async function SettingsPage() {
  const [admins, settings, featureFlags] = await Promise.all([
    getAdminUsers(),
    getAdminSettings(),
    getFeatureFlags(),
  ]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage marketplace configuration and admin users</p>
      </div>

      {/* Admin Users */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Admin Users</h2>
          <button className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700">
            Invite Admin
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" role="table">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Admin</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Joined</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-4">
                    <p className="font-medium text-gray-900 dark:text-white">{admin.full_name || "Unnamed"}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">#{admin.id.slice(0, 8).toUpperCase()}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      admin.role === "super_admin" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    }`}>
                      {admin.role.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">{admin.email}</td>
                  <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(admin.created_at).toLocaleDateString("en-NP", {
                      dateStyle: "medium",
                      timeZone: "Asia/Kathmandu",
                    })}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button className="text-sm text-orange-600 hover:text-orange-700 font-medium">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Client-side interactive settings */}
      <SettingsClient
        settings={settings}
        featureFlags={featureFlags}
        onUpdateSetting={updateAdminSetting}
        onUpdateFeatureFlag={updateFeatureFlag}
      />
    </div>
  );
}
