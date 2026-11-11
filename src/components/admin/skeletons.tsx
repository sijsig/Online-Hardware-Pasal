"use client";

/**
 * Loading Skeleton Components
 * Reusable skeleton loaders for admin panel
 */

// Table row skeleton
export function TableRowSkeleton({ columns = 7 }: { columns?: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}

// Table skeleton with multiple rows
export function TableSkeleton({ rows = 5, columns = 7 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full" role="table">
        <thead className="bg-gray-50">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-6 py-3">
                <div className="h-4 bg-gray-300 rounded w-1/2" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Card skeleton
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/4 mb-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-gray-200 rounded mb-2" style={{ width: `${60 + Math.random() * 30}%` }} />
      ))}
    </div>
  );
}

// Stats grid skeleton
export function StatsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 animate-pulse">
          <div className="flex items-start justify-between">
            <div className="w-8 h-8 rounded bg-gray-200" />
            <div className="w-16 h-4 bg-gray-200 rounded" />
          </div>
          <div className="mt-3 h-8 bg-gray-200 rounded w-1/2" />
          <div className="mt-1 h-4 bg-gray-200 rounded w-3/4" />
        </div>
      ))}
    </div>
  );
}

// Detail page skeleton
export function DetailPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded bg-gray-200" />
        <div>
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="mt-1 h-4 bg-gray-200 rounded w-1/4" />
        </div>
      </div>

      {/* Status badges */}
      <div className="flex items-center gap-3">
        <div className="w-32 h-8 rounded-full bg-gray-200" />
        <div className="w-24 h-8 rounded-full bg-gray-200" />
      </div>

      {/* Grid content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} lines={4} />
          ))}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={4} />
        </div>
      </div>
    </div>
  );
}

// List item skeleton
export function ListItemSkeleton({ hasAvatar = true, lines = 2 }: { hasAvatar?: boolean; lines?: number }) {
  return (
    <div className="flex items-center gap-4 px-6 py-4 animate-pulse">
      {hasAvatar && <div className="w-10 h-10 rounded-full bg-gray-200" />}
      <div className="flex-1">
        <div className="h-5 bg-gray-200 rounded w-1/3" />
        {Array.from({ length: lines - 1 }).map((_, i) => (
          <div key={i} className="mt-1 h-4 bg-gray-200 rounded w-1/2" />
        ))}
      </div>
      <div className="w-24 h-6 bg-gray-200 rounded" />
    </div>
  );
}

// Dashboard skeleton
export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-7 bg-gray-200 rounded w-1/4" />
          <div className="mt-1 h-4 bg-gray-200 rounded w-1/2" />
        </div>
        <div className="w-40 h-10 bg-gray-200 rounded" />
      </div>

      {/* Quick stats */}
      <StatsGridSkeleton count={6} />

      {/* Recent activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        <CardSkeleton lines={5} />
        <CardSkeleton lines={3} />
        <CardSkeleton lines={3} />
      </div>
    </div>
  );
}
