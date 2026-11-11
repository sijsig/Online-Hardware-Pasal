"use client";

import React, { useState } from "react";
import { useCsvExport, CsvExportOptions } from "@/hooks/useCsvExport";

interface ColumnConfig {
  key: string;
  label: string;
  format?: (value: any) => string;
}

interface ExportButtonProps<T> {
  /** Data to export (if client-side) */
  data?: T[];
  /** API URL for server-side export */
  apiUrl?: string;
  /** Columns to include */
  columns?: ColumnConfig[];
  /** Filename without extension */
  filename?: string;
  /** Whether to include headers */
  includeHeaders?: boolean;
  /** Custom delimiter */
  delimiter?: string;
  /** Add BOM for Excel compatibility */
  withBOM?: boolean;
  /** Button label */
  label?: string;
  /** Button icon */
  icon?: React.ReactNode;
  /** Button variant */
  variant?: "default" | "outline" | "ghost";
  /** Button size */
  size?: "sm" | "md" | "lg";
  /** Disabled state */
  disabled?: boolean;
  /** Additional className */
  className?: string;
  /** Callback after export */
  onExport?: () => void;
}

const variantStyles = {
  default: "bg-orange-600 text-white hover:bg-orange-700",
  outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
  ghost: "bg-transparent text-gray-700 hover:bg-gray-100",
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export function ExportButton<T>({
  data,
  apiUrl,
  columns,
  filename,
  includeHeaders = true,
  delimiter = ",",
  withBOM = true,
  label = "Export CSV",
  icon,
  variant = "default",
  size = "md",
  disabled,
  className = "",
  onExport,
}: ExportButtonProps<T>) {
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<ColumnConfig[]>(columns || []);
  
  const { exportData, loading, error } = useCsvExport();
  const [serverLoading, setServerLoading] = useState(false);

  const handleExport = async () => {
    const cols = selectedColumns.length > 0 ? selectedColumns : columns;
    
    if (apiUrl) {
      // Server-side export
      setServerLoading(true);
      try {
        const url = new URL(apiUrl, window.location.origin);
        url.searchParams.set("export", "true");
        
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error("Failed to fetch data");
        
        const json = await response.json();
        const exportDataResult = json.data || [];
        
        exportData({
          data: exportDataResult,
          columns: cols as CsvExportOptions<any>["columns"],
          filename,
          includeHeaders,
          delimiter,
          withBOM,
        });
        
        onExport?.();
      } catch (err) {
        console.error("Export failed:", err);
        alert("Export failed: " + (err instanceof Error ? err.message : "Unknown error"));
      } finally {
        setServerLoading(false);
      }
    } else if (data) {
      // Client-side export
      exportData({
        data,
        columns: cols as CsvExportOptions<any>["columns"],
        filename,
        includeHeaders,
        delimiter,
        withBOM,
      });
      onExport?.();
    }
  };

  const isLoading = loading || serverLoading;
  
  // Get all columns from data if not provided
  const allColumns: ColumnConfig[] = columns || (data && data.length > 0 
    ? Object.keys(data[0] as Record<string, unknown>).map(k => ({ key: k, label: k }))
    : []);

  return (
    <div className="relative inline-flex">
      {/* Main export button */}
      <button
        onClick={handleExport}
        disabled={disabled || isLoading || (!data && !apiUrl)}
        className={`
          inline-flex items-center justify-center gap-2 font-medium rounded-lg
          transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Exporting...
          </>
        ) : (
          <>
            {icon}
            {label}
          </>
        )}
      </button>

      {/* Column picker dropdown */}
      {allColumns.length > 0 && !apiUrl && (
        <div className="relative">
          <button
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className={`
              ml-1 inline-flex items-center justify-center p-2 rounded-r-lg
              transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
              ${variantStyles[variant]}
              ${sizeStyles[size]}
            `}
            aria-label="Select columns"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {showColumnPicker && (
            <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-xl border border-gray-200 bg-white shadow-lg p-3">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">Select Columns</h4>
                <div className="flex gap-1">
                  <button
                    onClick={() => setSelectedColumns(allColumns.map(c => ({ ...c })))}
                    className="text-xs text-orange-600 hover:text-orange-700"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedColumns([])}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="space-y-2 max-h-60 overflow-auto">
                {allColumns.map((col, index) => (
                  <label key={col.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedColumns.some(c => c.key === col.key)}
                      onChange={(e) => {
                        setSelectedColumns(prev => {
                          const next = [...prev];
                          if (e.target.checked) {
                            return [...next, allColumns[index]];
                          }
                          return next.filter(c => c.key !== col.key);
                        });
                      }}
                      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">{col.label}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={() => { setShowColumnPicker(false); handleExport(); }}
                className="w-full mt-3 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
              >
                Export Selected
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          Export failed: {error.message}
        </div>
      )}
    </div>
  );
}

/**
 * Quick export buttons for common use cases
 */
interface QuickExportButtonsProps<T> {
  data?: T[];
  apiUrl?: string;
  filename?: string;
  columns?: ColumnConfig[];
  className?: string;
}

export function QuickExportButtons<T>({ 
  data, 
  apiUrl, 
  filename = "export",
  columns,
  className = "",
}: QuickExportButtonsProps<T>) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ExportButton
        data={data}
        apiUrl={apiUrl}
        filename={filename}
        columns={columns}
        label="CSV"
        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
        variant="outline"
        size="sm"
      />
      <ExportButton
        data={data}
        apiUrl={apiUrl}
        filename={filename}
        columns={columns}
        label="Excel"
        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
        variant="outline"
        size="sm"
        delimiter="\t"
        withBOM={true}
      />
    </div>
  );
}
