"use client";

import { useCallback, useState } from "react";

export interface CsvExportOptions<T> {
  /** Data to export */
  data: T[];
  /** Columns to include (if not provided, uses all keys from first item) */
  columns?: Array<{ key: keyof T; label: string; format?: (value: any) => string }>;
  /** Filename without extension */
  filename?: string;
  /** Whether to include headers */
  includeHeaders?: boolean;
  /** Custom delimiter */
  delimiter?: string;
  /** Add BOM for Excel compatibility */
  withBOM?: boolean;
}

interface UseCsvExportReturn {
  /** Export data to CSV and trigger download */
  exportData: (options: CsvExportOptions<any>) => void;
  /** Whether export is in progress */
  loading: boolean;
  /** Last error if any */
  error: Error | null;
}

/**
 * Hook for exporting data to CSV
 */
export function useCsvExport(): UseCsvExportReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const exportData = useCallback((options: CsvExportOptions<any>) => {
    const {
      data,
      columns,
      filename = "export",
      includeHeaders = true,
      delimiter = ",",
      withBOM = true,
    } = options;

    if (!data || data.length === 0) {
      setError(new Error("No data to export"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Determine columns
      const keys = columns 
        ? columns.map(c => c.key as string)
        : Object.keys(data[0]);

      const labels = columns
        ? columns.map(c => c.label)
        : keys;

      // Build CSV rows
      const rows: string[] = [];

      // Add headers
      if (includeHeaders) {
        rows.push(labels.map(escapeCsv).join(delimiter));
      }

      // Add data rows
      for (const item of data) {
        const row = keys.map((key, index) => {
          const value = item[key];
          const format = columns?.[index]?.format;
          
          if (format) {
            return escapeCsv(format(value));
          }
          
          return escapeCsv(value);
        });
        rows.push(row.join(delimiter));
      }

      // Create CSV string
      let csv = rows.join("\n");
      
      // Add BOM for Excel compatibility
      if (withBOM) {
        csv = "\uFEFF" + csv;
      }

      // Create blob and download
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Export failed"));
    } finally {
      setLoading(false);
    }
  }, []);

  return { exportData, loading, error };
}

/**
 * Escape CSV value (handles commas, quotes, newlines)
 */
function escapeCsv(value: any): string {
  if (value === null || value === undefined) return "";
  
  const str = String(value);
  
  // If contains delimiter, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

/**
 * Pre-configured export hooks for common admin tables
 */

export function useExportShops() {
  return useCsvExport();
}

export function useExportRiders() {
  return useCsvExport();
}

export function useExportOrders() {
  return useCsvExport();
}

export function useExportProducts() {
  return useCsvExport();
}

export function useExportCustomers() {
  return useCsvExport();
}

export function useExportPayments() {
  return useCsvExport();
}

/**
 * Hook for exporting with current page filters (for server-side data)
 * Uses a fetch to get all data before exporting
 */
export function useServerExport<T>(apiUrl: string, options?: {
  filename?: string;
  transform?: (data: T[]) => T[];
}) {
  const { exportData, loading } = useCsvExport();
  const [serverLoading, setServerLoading] = useState(false);
  const [serverError, setServerError] = useState<Error | null>(null);

  const exportAll = useCallback(async (params?: Record<string, string>) => {
    setServerLoading(true);
    setServerError(null);

    try {
      // Build URL with params
      const url = new URL(apiUrl, window.location.origin);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });
      }
      // Add export flag to get all data
      url.searchParams.set("export", "true");

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error("Failed to fetch data");

      const json = await response.json();
      let data = json.data || [];

      if (options?.transform) {
        data = options.transform(data);
      }

      exportData({
        data,
        filename: options?.filename || "export",
      });
    } catch (err) {
      setServerError(err instanceof Error ? err : new Error("Export failed"));
    } finally {
      setServerLoading(false);
    }
  }, [apiUrl, exportData, options]);

  return { 
    exportData: exportAll, 
    loading: loading || serverLoading, 
    error: serverError 
  };
}
