"use client";

import React, { forwardRef } from "react";
import { useAdminAction } from "@/hooks/useAdminAction";

interface ActionButtonProps<TArgs extends unknown[]> 
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The server action to execute */
  action: (...args: TArgs) => Promise<unknown>;
  /** Arguments to pass to the action */
  actionArgs: TArgs;
  /** Toast message on success */
  successMessage?: string;
  /** Toast message on error */
  errorMessage?: string;
  /** Callback on success */
  onSuccess?: () => void;
  /** Button label when loading */
  loadingLabel?: string;
  /** Button label when not loading */
  children: React.ReactNode;
  /** Button variant */
  variant?: "default" | "destructive" | "outline" | "ghost";
  /** Button size */
  size?: "sm" | "md" | "lg";
}

const variantStyles = {
  default: "bg-orange-600 text-white hover:bg-orange-700",
  destructive: "bg-red-600 text-white hover:bg-red-700",
  outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
  ghost: "bg-transparent text-gray-700 hover:bg-gray-100",
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps<unknown[]>>(
  function ActionButton(
    {
      action,
      actionArgs,
      successMessage,
      errorMessage,
      onSuccess,
      loadingLabel,
      children,
      variant = "default",
      size = "md",
      disabled,
      className = "",
      ...props
    },
    ref
  ) {
    const { execute, loading } = useAdminAction(action, {
      successMessage,
      errorMessage,
      onSuccess,
    });

    const handleClick = () => {
      execute(...actionArgs);
    };

    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center gap-2 font-medium rounded-lg
          transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {loadingLabel || "Processing..."}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

ActionButton.displayName = "ActionButton";

/**
 * ConfirmActionButton - Requires confirmation before executing
 */
interface ConfirmActionButtonProps<TArgs extends unknown[]> 
  extends Omit<ActionButtonProps<TArgs>, "children"> {
  /** Confirmation message */
  confirmMessage?: string;
  /** Button label - can be string or ReactNode for icons */
  label: React.ReactNode;
  /** Button label when confirmed but not yet executed */
  confirmingLabel?: React.ReactNode;
}

export function ConfirmActionButton<TArgs extends unknown[]>({
  action,
  actionArgs,
  successMessage,
  errorMessage,
  onSuccess,
  confirmMessage,
  label,
  confirmingLabel,
  variant = "destructive",
  size = "md",
  disabled,
  className = "",
  ...props
}: ConfirmActionButtonProps<TArgs>) {
  const [showConfirm, setShowConfirm] = React.useState(false);
  const { execute, loading } = useAdminAction(action, {
    successMessage,
    errorMessage,
    onSuccess: () => {
      setShowConfirm(false);
      onSuccess?.();
    },
  });

  const handleConfirm = () => {
    execute(...actionArgs);
  };

  if (showConfirm) {
    return (
      <div className="inline-flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={loading}
          className={`
            inline-flex items-center justify-center gap-2 font-medium rounded-lg
            transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
            ${variantStyles.destructive}
            ${sizeStyles[size]}
            ${className}
          `}
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {confirmingLabel || "Confirming..."}
            </>
          ) : (
            confirmingLabel || "Yes, confirm"
          )}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={loading}
          className={`
            inline-flex items-center justify-center gap-2 font-medium rounded-lg
            transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
            ${variantStyles.outline}
            ${sizeStyles[size]}
          `}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 font-medium rounded-lg
        transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {label}
    </button>
  );
}
