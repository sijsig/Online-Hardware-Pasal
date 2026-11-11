"use client";

import React from "react";
import { ConfirmActionButton } from "./action-button";

interface BulkActionToolbarProps {
  /** Number of selected items */
  selectedCount: number;
  /** Total number of items */
  totalCount: number;
  /** Whether all items are selected */
  selectAll: boolean;
  /** Whether selection is indeterminate */
  isIndeterminate: boolean;
  /** Toggle select all */
  onToggleSelectAll: () => void;
  /** Clear selection */
  onClearSelection: () => void;
  /** Toggle single item selection */
  onToggleSelect: (id: string) => void;
  /** Bulk action buttons */
  actions: Array<{
    label: string;
    onClick: () => void;
    variant?: "default" | "destructive" | "outline";
    icon?: React.ReactNode;
    disabled?: boolean;
    confirmMessage?: string;
  }>;
  /** Custom render for selected count */
  renderSelectedCount?: (count: number, total: number) => React.ReactNode;
}

export function BulkActionToolbar({
  selectedCount,
  totalCount,
  selectAll,
  isIndeterminate,
  onToggleSelectAll,
  onClearSelection,
  onToggleSelect,
  actions,
  renderSelectedCount,
}: BulkActionToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-sm shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Selection info */}
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectAll}
              onChange={onToggleSelectAll}
              className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              aria-label={selectAll ? "Deselect all" : "Select all"}
            />
            <span className="text-sm font-medium text-gray-900">
              {renderSelectedCount 
                ? renderSelectedCount(selectedCount, totalCount)
                : `${selectedCount} of ${totalCount} selected`}
            </span>
          </label>

          <button
            onClick={onClearSelection}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear selection
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {actions.map((action, index) => (
            <ConfirmActionButton
              key={action.label + index}
              action={async () => {}}
              actionArgs={[]}
              label={action.icon ? <span className="inline-flex items-center gap-1">{action.icon}{action.label}</span> : action.label}
              confirmMessage={action.confirmMessage}
              variant={action.variant || "default"}
              disabled={action.disabled || false}
              className="inline-flex items-center gap-2"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Checkbox column for tables
 */
interface CheckboxColumnProps {
  itemId: string;
  checked: boolean;
  onChange: (id: string) => void;
  disabled?: boolean;
  indeterminate?: boolean;
}

export function CheckboxColumn({ itemId, checked, onChange, disabled, indeterminate }: CheckboxColumnProps) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={() => onChange(itemId)}
      disabled={disabled}
      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
      aria-label={checked ? "Deselect" : "Select"}
      // Note: indeterminate can only be set via ref in React
    />
  );
}

/**
 * Table header checkbox for select all
 */
interface TableHeaderCheckboxProps {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  disabled?: boolean;
}

export function TableHeaderCheckbox({ checked, indeterminate, onChange, disabled }: TableHeaderCheckboxProps) {
  const checkboxRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={checkboxRef}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
      aria-label={checked ? "Deselect all" : "Select all"}
    />
  );
}
