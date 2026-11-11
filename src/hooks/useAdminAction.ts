"use client";

import { useState, useCallback } from "react";
import toast from "react-hot-toast";

/**
 * Hook for handling Server Actions with toast feedback
 * Usage:
 *   const { execute, loading } = useAdminAction(approveShop, {
 *     successMessage: "Shop approved successfully",
 *     errorMessage: "Failed to approve shop",
 *     onSuccess: () => router.refresh()
 *   });
 *   
 *   <button onClick={() => execute(shopId)} disabled={loading}>Approve</button>
 */

interface UseAdminActionOptions<TArgs extends unknown[], TResult> {
  /** Toast message on success */
  successMessage?: string;
  /** Toast message on error (will append error details) */
  errorMessage?: string;
  /** Callback on successful execution */
  onSuccess?: (result: TResult) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

interface UseAdminActionReturn<TArgs extends unknown[], TResult> {
  /** Execute the action */
  execute: (...args: TArgs) => Promise<TResult | null>;
  /** Whether the action is currently executing */
  loading: boolean;
  /** Last error if any */
  error: Error | null;
}

export function useAdminAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options: UseAdminActionOptions<TArgs, TResult> = {}
): UseAdminActionReturn<TArgs, TResult> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await action(...args);
        
        if (options.successMessage) {
          toast.success(options.successMessage);
        }
        
        options.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        
        const message = options.errorMessage 
          ? `${options.errorMessage}: ${error.message}`
          : error.message;
        
        toast.error(message);
        options.onError?.(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [action, options]
  );

  return { execute, loading, error };
}

/**
 * Specialized hook for form actions that redirect on success
 */
interface UseRedirectActionOptions {
  successMessage?: string;
  errorMessage?: string;
  redirectTo?: string;
  onSuccess?: () => void;
}

export function useRedirectAction<TArgs extends unknown[]>(
  action: (...args: TArgs) => Promise<{ success?: boolean; redirect?: string }>,
  options: UseRedirectActionOptions = {}
) {
  const [loading, setLoading] = useState(false);

  const execute = useCallback(
    async (...args: TArgs) => {
      setLoading(true);
      try {
        const result = await action(...args);
        
        if (result?.success) {
          if (options.successMessage) {
            toast.success(options.successMessage);
          }
          options.onSuccess?.();
          
          // Handle redirect
          if (result.redirect) {
            window.location.href = result.redirect;
          } else if (options.redirectTo) {
            window.location.href = options.redirectTo;
          }
        } else {
          throw new Error("Action did not return success");
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        toast.error(options.errorMessage ? `${options.errorMessage}: ${error.message}` : error.message);
      } finally {
        setLoading(false);
      }
    },
    [action, options]
  );

  return { execute, loading };
}
