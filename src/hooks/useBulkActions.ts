"use client";

import { useState, useCallback, useMemo } from "react";
import { useAdminAction } from "./useAdminAction";

interface BulkActionConfig<T> {
  /** Label for the bulk action */
  label: string;
  /** Icon for the action */
  icon?: React.ReactNode;
  /** Server action to call for each item */
  action: (id: string) => Promise<{ success?: boolean; error?: string }>;
  /** Success message template (use {count} for number of items) */
  successMessage: string;
  /** Error message template */
  errorMessage: string;
  /** Confirmation message before executing */
  confirmMessage?: string;
  /** Variant for the button */
  variant?: "default" | "destructive" | "outline";
  /** Whether action is available for selected items */
  available?: (items: T[]) => boolean;
}

/**
 * Hook for managing bulk actions on a list of items
 */
export function useBulkActions<T extends { id: string }>(
  items: T[],
  configs: BulkActionConfig<T>[]
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Create action hooks for each config
  const actionHooks = useMemo(
    () =>
      configs.map((config) =>
        useAdminAction(config.action, {
          successMessage: "",
          errorMessage: config.errorMessage,
        })
      ),
    [configs]
  );

  // Toggle single item selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Toggle select all
  const toggleSelectAll = useCallback(() => {
    setSelectAll((prev) => {
      const next = !prev;
      if (next) {
        setSelectedIds(new Set(items.map((item) => item.id)));
      } else {
        setSelectedIds(new Set());
      }
      return next;
    });
  }, [items]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectAll(false);
  }, []);

  // Get selected items
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  );

  // Execute bulk action
  const executeBulkAction = useCallback(
    async (configIndex: number) => {
      const config = configs[configIndex];
      const hook = actionHooks[configIndex];
      const itemsToProcess = selectedItems;

      if (itemsToProcess.length === 0) return;

      // Show confirmation if needed
      if (config.confirmMessage) {
        const confirmed = window.confirm(
          config.confirmMessage.replace("{count}", itemsToProcess.length.toString())
        );
        if (!confirmed) return;
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Process each item sequentially (could be parallelized with Promise.allSettled)
      for (const item of itemsToProcess) {
        try {
          const result = await hook.execute(item.id);
          if (result?.success !== false) {
            successCount++;
          } else {
            errorCount++;
            errors.push(`${item.id}: ${result?.error || "Unknown error"}`);
          }
        } catch (err) {
          errorCount++;
          errors.push(`${item.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
      }

      // Show results
      if (successCount > 0) {
        alert(config.successMessage.replace("{count}", successCount.toString()));
      }
      if (errorCount > 0) {
        alert(`${errorCount} failed:\n${errors.join("\n")}`);
      }

      // Clear selection after bulk action
      clearSelection();

      return { successCount, errorCount };
    },
    [configs, actionHooks, selectedItems, clearSelection]
  );

  // Derived state
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < items.length;
  const hasSelection = selectedIds.size > 0;

  return {
    // Selection state
    selectedIds,
    selectedItems,
    selectedCount: selectedIds.size,
    selectAll,
    isIndeterminate,
    hasSelection,
    // Actions
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    executeBulkAction,
    // Action configs (for rendering toolbar)
    configs,
    // Loading states
    loading: actionHooks.some((h) => h.loading),
  };
}

/**
 * Simplified hook for single bulk action (e.g., bulk approve)
 */
export function useBulkAction<T extends { id: string }>(
  items: T[],
  action: (id: string) => Promise<{ success?: boolean; error?: string }>,
  options: {
    label: string;
    successMessage: string;
    errorMessage: string;
    confirmMessage?: string;
    variant?: "default" | "destructive" | "outline";
    getIds?: (item: T) => string;
  }
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { execute, loading } = useAdminAction(action, {
    successMessage: "",
    errorMessage: options.errorMessage,
  });

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const executeBulk = useCallback(async () => {
    const itemsToProcess = items.filter((item) => 
      selectedIds.has(options.getIds?.(item) || item.id)
    );

    if (itemsToProcess.length === 0) return;

    if (options.confirmMessage) {
      const confirmed = window.confirm(
        options.confirmMessage.replace("{count}", itemsToProcess.length.toString())
      );
      if (!confirmed) return;
    }

    let successCount = 0;
    for (const item of itemsToProcess) {
      const id = options.getIds?.(item) || item.id;
      const result = await execute(id);
      if (result?.success !== false) successCount++;
    }

    if (successCount > 0) {
      alert(options.successMessage.replace("{count}", successCount.toString()));
    }
    clearSelection();
  }, [items, selectedIds, execute, options, clearSelection]);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggleSelect,
    clearSelection,
    executeBulk,
    loading,
    hasSelection: selectedIds.size > 0,
  };
}
