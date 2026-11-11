"use client";

import React, { useState, useCallback, useEffect } from "react";
import { createContext, useContext } from "react";

/* ============================================================
   Types
   ============================================================ */

export interface FilterPreset {
  id: string;
  name: string;
  filters: Record<string, any>;
  isDefault?: boolean;
}

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  pinned?: "left" | "right" | false;
}

export interface DateRangeFilter {
  type: "dateRange";
  key: string;
  label: string;
  value: { from: Date | null; to: Date | null };
}

export interface SelectFilter {
  type: "select";
  key: string;
  label: string;
  options: { value: string; label: string }[];
  value: string | string[];
  multiple?: boolean;
}

export interface TextFilter {
  type: "text";
  key: string;
  label: string;
  value: string;
  placeholder?: string;
}

export interface NumericFilter {
  type: "numeric";
  key: string;
  label: string;
  value: { min: number | null; max: number | null };
}

export type FilterConfig = 
  | DateRangeFilter 
  | SelectFilter 
  | TextFilter 
  | NumericFilter;

export interface AdvancedFiltersProps {
  /** Filter configurations (defines available filters) */
  filterConfigs: FilterConfig[];
  /** Current filter values */
  filters: Record<string, any>;
  columns: ColumnConfig[];
  presets: FilterPreset[];
  onFiltersChange: (filters: Record<string, any>) => void;
  onColumnsChange: (columns: ColumnConfig[]) => void;
  onPresetSave: (name: string, filters: Record<string, any>) => void;
  onPresetDelete: (id: string) => void;
  className?: string;
  compact?: boolean;
}

/* ============================================================
   Context for filter state
   ============================================================ */

interface FiltersContextValue {
  filters: Record<string, any>;
  setFilters: (filters: Record<string, any>) => void;
  columns: ColumnConfig[];
  setColumns: (columns: ColumnConfig[]) => void;
  presets: FilterPreset[];
  addPreset: (name: string) => void;
  removePreset: (id: string) => void;
  applyPreset: (preset: FilterPreset) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function useAdvancedFilters() {
  const context = useContext(FiltersContext);
  if (!context) {
    throw new Error("useAdvancedFilters must be used within AdvancedFiltersProvider");
  }
  return context;
}

/* ============================================================
   Provider Component
   ============================================================ */

export function AdvancedFiltersProvider({
  children,
  initialFilters = {},
  initialColumns = [],
  initialPresets = [],
  onFiltersChange,
  onColumnsChange,
  onPresetSave,
  onPresetDelete,
}: {
  children: React.ReactNode;
  initialFilters?: Record<string, any>;
  initialColumns?: ColumnConfig[];
  initialPresets?: FilterPreset[];
  onFiltersChange?: (filters: Record<string, any>) => void;
  onColumnsChange?: (columns: ColumnConfig[]) => void;
  onPresetSave?: (name: string, filters: Record<string, any>) => void;
  onPresetDelete?: (id: string) => void;
}) {
  const [filters, setFiltersState] = useState<Record<string, any>>(initialFilters);
  const [columns, setColumnsState] = useState<ColumnConfig[]>(initialColumns);
  const [presets, setPresetsState] = useState<FilterPreset[]>(initialPresets);
  const [isOpen, setIsOpen] = useState(false);

  const setFilters = useCallback((newFilters: Record<string, any>) => {
    setFiltersState(newFilters);
    onFiltersChange?.(newFilters);
  }, [onFiltersChange]);

  const setColumns = useCallback((newColumns: ColumnConfig[]) => {
    setColumnsState(newColumns);
    onColumnsChange?.(newColumns);
  }, [onColumnsChange]);

  const addPreset = useCallback((name: string) => {
    const newPreset: FilterPreset = {
      id: `preset_${Date.now()}`,
      name,
      filters: { ...filters },
    };
    setPresetsState(prev => [...prev, newPreset]);
    onPresetSave?.(name, filters);
  }, [filters, onPresetSave]);

  const removePreset = useCallback((id: string) => {
    setPresetsState(prev => prev.filter(p => p.id !== id));
    onPresetDelete?.(id);
  }, [onPresetDelete]);

  const applyPreset = useCallback((preset: FilterPreset) => {
    setFilters(preset.filters);
  }, [setFilters]);

  return (
    <FiltersContext.Provider
      value={{
        filters,
        setFilters,
        columns,
        setColumns,
        presets,
        addPreset,
        removePreset,
        applyPreset,
        isOpen,
        setIsOpen,
      }}
    >
      {children}
    </FiltersContext.Provider>
  );
}

/* ============================================================
   Filter Input Components
   ============================================================ */

function DateRangeFilterInput({ 
  config, 
  value, 
  onChange 
}: { 
  config: DateRangeFilter; 
  value: any; 
  onChange: (value: any) => void 
}) {
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  useEffect(() => {
    if (value?.from) setFrom(value.from.toISOString().split("T")[0]);
    if (value?.to) setTo(value.to.toISOString().split("T")[0]);
  }, [value]);

  const handleChange = () => {
    const newValue = {
      from: from ? new Date(from) : null,
      to: to ? new Date(to) : null,
    };
    onChange(newValue);
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
        <input
          type="date"
          value={from}
          onChange={(e) => { setFrom(e.target.value); handleChange(); }}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
        <input
          type="date"
          value={to}
          onChange={(e) => { setTo(e.target.value); handleChange(); }}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
        />
      </div>
    </div>
  );
}

function SelectFilterInput({ 
  config, 
  value, 
  onChange 
}: { 
  config: SelectFilter; 
  value: any; 
  onChange: (value: any) => void 
}) {
  if (config.multiple) {
    return (
      <select
        multiple
        value={value || []}
        onChange={(e) => {
          const selected = Array.from(e.target.selectedOptions).map(o => o.value);
          onChange(selected);
        }}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm min-h-[100px]"
      >
        {config.options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  }

  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
    >
      <option value="">All {config.label}</option>
      {config.options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

function TextFilterInput({ 
  config, 
  value, 
  onChange 
}: { 
  config: TextFilter; 
  value: string; 
  onChange: (value: string) => void 
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={config.placeholder}
      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
    />
  );
}

function NumericFilterInput({ 
  config, 
  value, 
  onChange 
}: { 
  config: NumericFilter; 
  value: any; 
  onChange: (value: any) => void 
}) {
  const [min, setMin] = useState<string>("");
  const [max, setMax] = useState<string>("");

  useEffect(() => {
    if (value?.min !== null && value?.min !== undefined) setMin(String(value.min));
    if (value?.max !== null && value?.max !== undefined) setMax(String(value.max));
  }, [value]);

  const handleChange = () => {
    onChange({
      min: min !== "" ? Number(min) : null,
      max: max !== "" ? Number(max) : null,
    });
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Min</label>
        <input
          type="number"
          value={min}
          onChange={(e) => { setMin(e.target.value); handleChange(); }}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Max</label>
        <input
          type="number"
          value={max}
          onChange={(e) => { setMax(e.target.value); handleChange(); }}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
        />
      </div>
    </div>
  );
}

/* ============================================================
   Main AdvancedFilters Component
   ============================================================ */

export function AdvancedFilters({
  filterConfigs,
  filters,
  columns,
  presets,
  onFiltersChange,
  onColumnsChange,
  onPresetSave,
  onPresetDelete,
  className = "",
  compact = false,
}: AdvancedFiltersProps) {
  const [showColumns, setShowColumns] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  const hasActiveFilters = Object.values(filters).some(v => 
    v !== null && v !== undefined && v !== "" && 
    (Array.isArray(v) ? v.length > 0 : true) &&
    (typeof v === "object" && !Array.isArray(v) ? 
      ("from" in v && v.from) || ("to" in v && v.to) || ("min" in v && v.min !== null) || ("max" in v && v.max !== null) : true)
  );

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Filter Inputs */}
      <div className="flex flex-wrap gap-3">
        {filterConfigs.map((config) => (
          <div key={config.key} className="min-w-[200px] max-w-[300px]">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {config.label}
            </label>
            {config.type === "dateRange" ? (
              <DateRangeFilterInput 
                config={config} 
                value={filters[config.key]} 
                onChange={(v) => onFiltersChange({ ...filters, [config.key]: v })} 
              />
            ) : config.type === "select" ? (
              <SelectFilterInput 
                config={config} 
                value={filters[config.key]} 
                onChange={(v) => onFiltersChange({ ...filters, [config.key]: v })} 
              />
            ) : config.type === "numeric" ? (
              <NumericFilterInput 
                config={config} 
                value={filters[config.key]} 
                onChange={(v) => onFiltersChange({ ...filters, [config.key]: v })} 
              />
            ) : (
              <TextFilterInput 
                config={config} 
                value={filters[config.key] || ""} 
                onChange={(v) => onFiltersChange({ ...filters, [config.key]: v })} 
              />
            )}
          </div>
        ))}
      </div>

      {/* Column Visibility Toggle */}
      <div className="relative">
        <button
          onClick={() => setShowColumns(!showColumns)}
          className={`inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
            showColumns
              ? "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 shadow-sm"
              : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="hidden sm:inline">Columns</span>
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        </button>

        {showColumns && (
          <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900 dark:text-white">Column Visibility</h4>
              <button onClick={() => setShowColumns(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
            </div>
            <div className="space-y-2 max-h-60 overflow-auto">
              {columns.map((col) => (
                <label key={col.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={(e) => onColumnsChange(columns.map(c => c.key === col.key ? { ...c, visible: e.target.checked } : c))}
                    className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 capitalize truncate">{col.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => onColumnsChange(columns.map(c => ({ ...c, visible: true })))}
                className="flex-1 text-xs text-orange-600 hover:text-orange-700"
              >
                Show All
              </button>
              <button
                onClick={() => onColumnsChange(columns.map(c => ({ ...c, visible: false })))}
                className="flex-1 text-xs text-gray-500 hover:text-gray-700"
              >
                Hide All
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Presets Dropdown */}
      { (presets.length > 0 || typeof onPresetSave === "function") && (
        <div className="relative">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className={`inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showPresets
                ? "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 shadow-sm"
                : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="hidden sm:inline">Presets</span>
          </button>

          {showPresets && (
            <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-3">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900 dark:text-white">Filter Presets</h4>
                <button onClick={() => setShowPresets(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
              </div>
              
              {presets.length > 0 && (
                <div className="space-y-1 mb-3">
                  {presets.map((preset) => (
                    <div key={preset.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                      <button
                        onClick={() => {
                          // Apply preset - would need context
                        }}
                        className="flex-1 text-left text-sm text-gray-900 dark:text-white font-medium"
                      >
                        {preset.name} {preset.isDefault && <span className="ml-2 text-xs text-gray-400">(default)</span>}
                      </button>
                      <button
                        onClick={() => onPresetDelete?.(preset.id)}
                        className="text-gray-400 hover:text-red-500"
                        aria-label="Delete preset"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {onPresetSave && (
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      placeholder="Preset name"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                    />
                    <button
                      onClick={() => {
                        onPresetSave(newPresetName, filters);
                        setNewPresetName("");
                        setShowPresets(false);
                      }}
                      disabled={!newPresetName.trim()}
                      className="px-3 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={() => onFiltersChange({})}
          className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

/* ============================================================
   Hook for creating filter configs easily
   ============================================================ */

export function createDateRangeFilter(key: string, label: string): DateRangeFilter {
  return { type: "dateRange", key, label, value: { from: null, to: null } };
}

export function createSelectFilter(key: string, label: string, options: { value: string; label: string }[], multiple = false): SelectFilter {
  return { type: "select", key, label, options, value: multiple ? [] : "", multiple };
}

export function createTextFilter(key: string, label: string, placeholder?: string): TextFilter {
  return { type: "text", key, label, value: "", placeholder };
}

export function createNumericFilter(key: string, label: string): NumericFilter {
  return { type: "numeric", key, label, value: { min: null, max: null } };
}
