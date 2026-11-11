"use client";

import { useState } from "react";

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

type SettingInputProps = {
  setting: AdminSetting;
  onChange: (key: string, value: any) => Promise<{ success: boolean }>;
};

type FeatureFlagToggleProps = {
  flag: FeatureFlag;
  onChange: (key: string, enabled: boolean, options?: { rollout_percentage?: number; target_roles?: string[] }) => Promise<{ success: boolean }>;
};

function isNumeric(value: any): boolean {
  return typeof value === "number" || (typeof value === "string" && !isNaN(Number(value)) && value !== "");
}

function formatKey(key: string): string {
  return key
    .split(".")
    .pop()!
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function SettingInput({ setting, onChange }: SettingInputProps) {
  const [value, setValue] = useState<string>(typeof setting.value === "string" ? setting.value : String(setting.value));
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onChange(setting.key, isNumeric(setting.value) ? Number(value) : value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save setting:", error);
      alert("Failed to save setting");
    } finally {
      setIsSaving(false);
    }
  };

  const isNumber = isNumeric(setting.value);
  const isBoolean = typeof setting.value === "boolean";

  if (isBoolean) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{formatKey(setting.key)}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{setting.description || ""}</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={setting.value}
            onChange={(e) => {
              setValue(String(e.target.checked));
              handleSave();
            }}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {formatKey(setting.key)}
      </label>
      <div className="flex gap-2">
        <input
          type={isNumber ? "number" : "text"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          step={isNumber ? "0.01" : undefined}
        />
        <button
          onClick={handleSave}
          disabled={isSaving || value === String(setting.value)}
          className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving..." : saved ? "Saved ✓" : "Save"}
        </button>
      </div>
      {setting.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{setting.description}</p>
      )}
    </div>
  );
}

export function FeatureFlagToggle({ flag, onChange }: FeatureFlagToggleProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localFlag, setLocalFlag] = useState(flag);

  const handleToggle = async (enabled: boolean) => {
    setIsSaving(true);
    try {
      await onChange(localFlag.key, enabled, {
        rollout_percentage: localFlag.rollout_percentage,
        target_roles: localFlag.target_roles,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save feature flag:", error);
      alert("Failed to save feature flag");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRolloutChange = (value: number) => {
    const newValue = Math.max(0, Math.min(100, value));
    setLocalFlag(prev => ({ ...prev, rollout_percentage: newValue }));
  };

  const handleTargetRolesChange = (roles: string[]) => {
    setLocalFlag(prev => ({ ...prev, target_roles: roles }));
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <p className="font-medium text-gray-900 dark:text-white">{formatKey(localFlag.key)}</p>
          {localFlag.rollout_percentage < 100 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
              {localFlag.rollout_percentage}% rollout
            </span>
          )}
          {localFlag.target_roles.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              {localFlag.target_roles.join(", ")}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{localFlag.description || "No description"}</p>
      </div>
      <div className="flex items-center gap-4">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={localFlag.enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            className="sr-only peer"
            disabled={isSaving}
          />
          <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600 peer-disabled:opacity-50"></div>
        </label>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          aria-label={showAdvanced ? "Hide advanced options" : "Show advanced options"}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19h4M12 9l-3 3m0 0l3 3m-3-3h12.5c2.5 0 4.5-1.5 4.5-4v-5.5c0-2.5-2-4.5-4.5-4.5H12" />
          </svg>
        </button>
      </div>
      
      {showAdvanced && (
        <div className="mt-4 ml-16 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <label className="text-gray-500 dark:text-gray-400">Rollout %</label>
            <input
              type="number"
              value={localFlag.rollout_percentage}
              onChange={(e) => handleRolloutChange(Number(e.target.value))}
              min={0}
              max={100}
              className="w-20 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-gray-500 dark:text-gray-400">Target Roles</label>
            <select
              multiple
              value={localFlag.target_roles}
              onChange={(e) => handleTargetRolesChange(Array.from(e.target.selectedOptions).map(o => o.value))}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white min-h-[80px]"
            >
              <option value="customer">Customer</option>
              <option value="vendor">Vendor</option>
              <option value="rider">Rider</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
        </div>
      )}
      
      {saved && (
        <span className="text-xs text-green-600 dark:text-green-400">Saved ✓</span>
      )}
    </div>
  );
}

export function SettingsClient({ 
  settings, 
  featureFlags,
  onUpdateSetting,
  onUpdateFeatureFlag,
}: {
  settings: AdminSetting[];
  featureFlags: FeatureFlag[];
  onUpdateSetting: (key: string, value: any) => Promise<{ success: boolean }>;
  onUpdateFeatureFlag: (key: string, enabled: boolean, options?: { rollout_percentage?: number; target_roles?: string[] }) => Promise<{ success: boolean }>;
}) {
  const categories = [
    { key: "general", label: "General", icon: "⚙️" },
    { key: "finance", label: "Finance", icon: "💰" },
    { key: "orders", label: "Orders", icon: "📦" },
    { key: "vendors", label: "Vendors", icon: "🏪" },
    { key: "delivery", label: "Delivery", icon: "🚚" },
  ];

  const settingsByCategory = settings.reduce((acc, setting) => {
    if (!acc[setting.category]) acc[setting.category] = [];
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, AdminSetting[]>);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Marketplace Settings by Category */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Marketplace Configuration</h2>
        
        {categories.map((category) => {
          const categorySettings = settingsByCategory[category.key] || [];
          if (categorySettings.length === 0) return null;

          return (
            <div key={category.key} className="space-y-4 py-4 border-t border-gray-100 dark:border-gray-700 first:border-t-0 first:pt-0">
              <h3 className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <span className="text-lg">{category.icon}</span>
                {category.label}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {categorySettings.map((setting) => (
                  <SettingInput 
                    key={setting.key} 
                    setting={setting}
                    onChange={onUpdateSetting}
                  />
                ))}
              </div>
            </div>
          );
        })}

        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button className="rounded-lg bg-orange-600 px-6 py-2 text-sm font-medium text-white hover:bg-orange-700">
            Save All Settings
          </button>
          <button className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            Cancel
          </button>
        </div>
      </section>

      {/* Feature Flags */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Feature Flags</h2>
          <button className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700">
            Save All Flags
          </button>
        </div>
        
        <div className="space-y-4">
          {featureFlags.map((flag) => (
            <FeatureFlagToggle 
              key={flag.key} 
              flag={flag}
              onChange={onUpdateFeatureFlag}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
